---
sidebar: auto
---

# 自定义指令编解码

近期参与研发的一个项目中, 涉及到与硬件的对接部分. 这里记录一部分数据协议制定与编解码的思路和代码实现. 用于以后类似功能的开发参考. 

## 硬件说明

需要对接的硬件设备为环境监测设备, 主要用于监测土壤与水质数据变化, 支持定时上报数据与接收服务器下发的命令后被动上报数据. 

设备由3部分构成. 1. 主杆-负责设备通讯. 2. 副杆-连接主杆与传感器设备. 3 传感器-实际接入土壤探测数据

### 数据帧说明(上下行通用) 

数据帧格式如下:

| STX | 字节数 | 流程码 | 主杆Id| 副杆Id | 指令码 | 指令数 | 操作数 | ETX | CRC L8 | CRC H8| 
| --- | ---    | ---    | ---   | ---    | ---    | ---    | ---    | --- | ---    | ---   |
| 1 | 2|3|4|5|6|7|8|9|10|11| 

1. STX固定为0x02, 表示帧头起始
2. 字节数为1字节十六进制数, 它表示 3 - 8 的字节数之和.
3. 4位的ASC码字符构成
4. 5位数字 0~9的ASC码. 
5. 5位数字 0~9的ASC码. 
6. 1位ASC码.
7. 3位0~9的ASC码构成
8. n为ASC码构成, n由 6 和 7 决定
9. ETX固定为0x03, 表示帧尾结束
10. CRC16校验的低8位, 1个字节的16进制数
11. CRC16校验的高8位, 1个字节的16进制数

### 下行(命令)数据帧示例  

| 1 | 2|3|4|5|6|7|8|9|10|11| 
| --- | ---    | ---    | ---   | ---    | ---    | ---    | ---    | --- | ---    | ---   |
| 0x02 | 0x14 | 0531 | 12345| 67890 | C | 014 | 80 | 0x03 | 0x75 | 0x03| 

6,7,8位数据解释:

| 6 | 7 | 8 |含义|
| ---| ---| ---|---|
| C|100| |上报土壤氮磷钾|
| C|101| |上报土壤PH|
| C|102| |上报土壤温湿度|
| C|103| |上报土壤电导率|
| C|104| |上报水质PH|

### 上行数据帧示例

普通的上行数据帧与下行命令帧格式大体相同. 区别是第8位会携带设备当前监测的环境数据. 

| 6 | 7 | 8 |含义|
| ---| ---| ---|---|
| c|100| 12位0~F的ASC码 (需要解密)|上报土壤氮磷钾|
| c|101| 4位0~F的ASC码 (需要解密)|上报土壤PH|
| c|102| 8位0~F的ASC码 (需要解密)|上报土壤温湿度|
| c|103| 4位0~F的ASC码 (需要解密)|上报土壤电导率|
| c|104| 4位0~F的ASC码 (需要解密)|上报水质PH|

| 6 | 7| 8| 含义|
同时第6位指令码可能会上报 "!" , 表示上报错误, 此时指令数部分为前次下行命令的指令数部分 , 同时操作数部分上报错误码. 错误码如下

- 00 表示流程码错误
- 01 副杆无响应
- 02 副杆通讯校验错误
- 03 传感器无响应
- ...


## 代码实现

### 1. 识别出上下行数据中的通用部分

因为我们的上下行数据帧格式大体相同, 所以我们可以封装一个单独的指令集类`InstructionSet`用来表示数据帧. 

```java 
public class InstructionSet {

    // 数据帧字节的base64格式
    private final String base64;
    // 实际的数据帧字节数组
    private final byte[] bytes;
    // 起始位置
    private byte stx;
    // 有效字节长度 3 - 8字节数
    private byte effectiveLen;
    // 流程码
    private byte[] processCode;
    // 主杆id
    private byte[] mainId;
    // 副杆id
    private byte[] assistantId;
    // 指令码
    private byte cmdCode;
    // 指令数
    private byte[] cmdNum;
    // 操作数
    private byte[] operNum;
    // 结束位置
    private byte etx;
    // crc16 低8位
    private byte crcL8;
    // crc16 高8位
    private byte crcH8;
}    
``` 

而后针对上下行数据不同指令码和指令数对应不同长度的操作数, 我们使用一个单独的数据结构来分别保存.

```java 
    static class CommandMap extends HashMap<Byte, Map<String, Integer>> {

        private final Map<String, Integer> EMPTY_ITS_NUM_MAP = newHashMap();

        /**
         *  根据指令码和指令数返回对应的操作数字节数
         * @param code  指令码
         * @param cmdNum  指令数
         * @return
         * @throws UsrsdkException
         */
        public int get(byte code, String cmdNum) throws UsrsdkException {

            Map<String, Integer> commandMap = getOrDefault(code, EMPTY_ITS_NUM_MAP);
            if (commandMap.isEmpty()) {
                throw new UsrsdkException(String.format("没有相匹配的指令数, 指令码为[%s]", (char) code));
            }

            int defaultCommand = -1;
            Integer commandLength = commandMap.getOrDefault(cmdNum, defaultCommand);
            if (defaultCommand == commandLength) {

                throw new UsrsdkException(String.format("没有相匹配的操作数, 指令码为[%s] , 指令数为[%s]", (char) code, cmdNum));
            }
            return commandLength;
        }

    }
```

而后, 在`InstructionSet`中分别保存上下行数据所对应的CommandMap. 

```java 
public class InstructionSet{
    ...
    
    // 上行
    private final static CommandMap UPWARD_COMMAND = new CommandMap() {
        {
            // c 100 12
            // c 101 4
            put((byte) 99, new HashMap<String, Integer>() {
                {
                    put("100", 12);
                    put("101", 4);
                    put("102", 8);
                    put("103", 4);
                    put("104", 4);
                }
            });

            // ! 100
            put((byte) 33, new HashMap<String, Integer>() {
                {
                    put("100", 3);
                    put("101", 3);
                    put("102", 3);
                    put("103", 3);
                    put("104", 3);
                    // todo 后续还会增加
                }
            });
        }
    };
    
    // 下行
    private final static CommandMap DOWN_COMMAND = new CommandMap() {

        {
            // C 100
            put((byte) 67, new HashMap<String, Integer>() {
                {
                    put("100", 0);
                    put("101", 0);
                    put("102", 0);
                    put("103", 0);
                    put("104", 0);
                    put("014", 2);
                }
            });
        }
    };    
}
```

### 2. 组装下行命令

为了方便其他服务调用, 隐藏内部实现细节. 将`InstructionSet`私有化, 由专门的Builder去构建. 

```java 
public class InstructionSet{
    ...
    private InstructionSet(byte[] bytes) {

        this.bytes = bytes;
        this.base64 = Base64Util.encode(bytes);
        this.initDown();
    }
}
```

Builder类

```java 
    public static class InstructionSetBuilder {
        
        // 内部限定流程码与主杆id等部分的长度
        private final byte[] processCode = new byte[4];
        private final byte[] mainId = new byte[5];
        private final byte[] assistantId = new byte[5];
        private byte cmdCode;
        private final byte[] cmdNum = new byte[3];
        private byte[] operNum = new byte[0];

        // 组装流程码
        public InstructionSetBuilder processCode(String processCode) {

            if (processCode.length() < this.processCode.length){
                processCode = String.format("%04d",Integer.parseInt(processCode));
            }
            char[] chars = processCode.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                this.processCode[i] = (byte) chars[i];
            }
            return this;
        }

        // 组装主杆id
        public InstructionSetBuilder mainId(String mainId) {

            if (mainId.length() < this.mainId.length){
                mainId = String.format("%04d",Integer.parseInt(mainId));
            }
            char[] chars = mainId.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                this.mainId[i] = (byte) chars[i];
            }
            return this;
        }

        // 组装副杆id
        public InstructionSetBuilder assistantId(String assistantId) {

            if (assistantId.length() < this.assistantId.length){
                assistantId = String.format("%04d",Integer.parseInt(assistantId));
            }
            char[] chars = assistantId.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                this.assistantId[i] = (byte) chars[i];
            }
            return this;
        }

        // 设置指令码
        public InstructionSetBuilder cmdCode(String cmdCode) {

            char[] chars = cmdCode.toCharArray();
            this.cmdCode = (byte) chars[0];
            return this;
        }

        // 设置指令数
        public InstructionSetBuilder cmdNum(String cmdNum) {

            char[] chars = cmdNum.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                this.cmdNum[i] = (byte) chars[i];
            }
            return this;
        }

        // 设置操作数
        public InstructionSetBuilder operNum(String operNum) {

            char[] chars = operNum.toCharArray();
            this.operNum = new byte[chars.length];
            for (int i = 0; i < chars.length; i++) {
                this.operNum[i] = (byte) chars[i];
            }
            return this;
        }

        // 将之前组装的各部分构建为一个新的指令集对象
        public InstructionSet encode() {

            return new InstructionSet(build());
        }

        private byte[] build() {
            // 检查当前持有的各部分是否符合协议规定
            checkInput();
            // 返回byte数组
            return buildByteArray();
        }

        private byte[] buildByteArray() {

            byte[] bytes = new byte[len()];
            int offset = 0;
            bytes[offset++] = STX;
            bytes[offset++] = (byte) effectiveLen();
            offset = loopAssignment(bytes, offset, processCode);
            offset = loopAssignment(bytes, offset, mainId);
            offset = loopAssignment(bytes, offset, assistantId);
            bytes[offset++] = cmdCode;
            offset = loopAssignment(bytes, offset, cmdNum);
            offset = loopAssignment(bytes, offset, operNum);
            bytes[offset++] = ETX;

            int crc = CRCUtil.crc(Arrays.copyOfRange(bytes, 0, bytes.length - 2));
            bytes[offset++] = (byte) crc;
            bytes[offset] = (byte) (crc >> 8);
            //2 18 48 53 51 49 49 50 51 52 53 54 55 56 57 48 67 49 48 48 3 24 14 2 30 48 53 51 49 49 50 51 52 53 54 55 56 57 48 99 49 48 48 48 48 48 49 48 48 48 49 48 48 48 49 3 -40 -74
            return bytes;
        }

        private void checkInput() {

            if (processCode.length == 0) {
                throw new UsrsdkException("流程码长度为0");
            }
            if (mainId.length == 0) {
                throw new UsrsdkException("主杆长度为0");
            }
            if (assistantId.length == 0) {
                throw new UsrsdkException("副杆长度为0");
            }
            if (!DOWN_COMMAND.containsKey(cmdCode)) {
                throw new UsrsdkException("指令码非法");
            }
            if (cmdNum.length == 0) {
                throw new UsrsdkException("指令数长度为0");
            }
        }

        private int loopAssignment(byte[] bytes, int offset, byte[] cmdNum) {

            for (byte b : cmdNum) {
                bytes[offset++] = b;
            }
            return offset;
        }

        private int len() {

            return 1 + 1 + effectiveLen() + 1 + 1 + 1;
        }

        private int effectiveLen() {

            return processCode.length + mainId.length + assistantId.length + 1 + cmdNum.length + operNum.length;
        }

    }
```

### 3. 解析上行数据

由于数据传输采用base64编码的形式, 所以`InstructionSet`需要单独暴露一个入口用于解码上行数据, 这里使用的是一个静态方法

```java 
public class InstructionSet{
    ...
    public static InstructionSet decode(String base64) {

        return new InstructionSet(base64);
    }
    private InstructionSet(String base64) {

        this.base64 = base64;
        this.bytes = Base64Util.decode(base64);
        this.initUp();
    }    
}
```

### 4. 单元测试

```java 

    @Test
    void test_decode() {

        InstructionSet set = InstructionSet.decode("AhUwMTExMTIzNDU2Nzg5MCExMDFDMDADJeg=");
        System.out.println(set.base64());
        System.out.println(set.processCode());
        System.out.println(set.mainId());
        System.out.println(set.assistantId());
        System.out.println(set.cmdCode());
        System.out.println(set.cmdNum());
        System.out.println(set.operNum());
    }  
    
    @Test
    void test_encode() {

        InstructionSet encode = InstructionSet.encoder()
                .processCode("0531")
                .mainId("12345")
                .assistantId("67890")
                .cmdCode("C")
                .cmdNum("100")
                .encode();

        System.out.println(encode.base64());
    }
          
```

## 其他

以上并没有描述设备上报的实际数据也就是操作数部分是如何解析的, 这一部分可以预留出来根据实际情况单独处理. 
