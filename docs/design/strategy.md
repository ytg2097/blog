---
prev: ./state
next: ./chain
---

# 策略模式

策略模式用于替代大量ifelse的场景, 针对不同的case给出专门的解决方案. 

## 示例

需求: 对接一个自动售货机, 服务器向售货机下发命令后, 售货机会返回响应, 服务器收到命令根据命令类型和执行结果做出对应操作

### 1. 定义命令

```java 
public enum Action {

    DOOR_OPEN("开门"),

    COMPRESSOR_OPEN("打开压缩机"),
    COMPRESSOR_CLOSE("关闭压缩机"),

    PUSH("出货"),

    QRCODE_ISSUED("下发二维码"),
    MANAGER_PHONE_ISSUED("下发管理员手机号"),

    SHOW_PRODUCT_INFO("展示商品信息"),
    ISSUED_PRODUCT_INFO("下发商品信息"),

    ISSUED_ADVERTISEMENT("下发广告"),
    INVALID_ADVERTISEMENT("失效广告"),

    VOLUME_UP("音量加"),
    VOLUME_DOWN("音量减"),

    MODIFY_PRODUCT_INFO("修改商品信息");


    public String getAction() {
        return action;
    }

    private String action;

    Action(String action) {
        this.action = action;
    }
}

```

### 2. 定义命令响应处理器

```java 
@Component
@Slf4j
@Transactional(rollbackFor = Exception.class)
public class CommandResponseHandler {

    // 持有针对各种命令响应成功的不同策略
    private final Map<Action, Consumer<Command>> successConsumerMap = newHashMap();

    // 持有针对各种命令响应失败的不同策略
    private final Map<Action, Consumer<Command>> failureConsumerMap = newHashMap();

    @PostConstruct
    private void initialize() {

        successConsumerMap.put(Action.COMPRESSOR_CLOSE, cmd -> System.out.println("压缩机已关闭"));
        successConsumerMap.put(Action.COMPRESSOR_OPEN, cmd -> System.out.println("压缩机已开启"));
        successConsumerMap.put(Action.QRCODE_ISSUED, cmd -> System.out.println("二维码已下发"));
        successConsumerMap.put(Action.DOOR_OPEN, cmd -> System.out.println("舱门打开"));
        successConsumerMap.put(Action.PUSH, cmd -> System.out.println("出货成功"));
        successConsumerMap.put(Action.ISSUED_ADVERTISEMENT, cmd -> System.out.println("广告下发成功"));
        successConsumerMap.put(Action.INVALID_ADVERTISEMENT, cmd -> System.out.println("广告失效成功"));
        successConsumerMap.put(Action.VOLUME_UP, cmd -> System.out.println("音量加一格"));
        successConsumerMap.put(Action.VOLUME_DOWN, cmd -> System.out.println("音量减一格"));

        failureConsumerMap.put(Action.PUSH, cmd -> System.out.println("出货失败"));
    }

    private void handleSuccessResponse(Command command) {

        // 若没有对应策略, 执行默认策略 c -> {}
        successConsumerMap.getOrDefault(command.getAction(), c -> {}).accept(command);
    }

    private void handleFailureResponse(Command command) {

        // 若没有对应策略, 执行默认策略 c -> {}
        failureConsumerMap.getOrDefault(command.getAction(), c -> {}).accept(command);
    }

    /**
    * 处理命令响应结果
    */
    public void onResponse(CommandResponseResult commandResponseResult) {

        Command command = getCmd(commandResponseResult);

        // 命令成功, 执行成功策略
        if (SUCCESS.equals(command.getResult())) {
            handleSuccessResponse(command);
        } else {
        // 执行失败策略
            handleFailureResponse(command);
        }
    }
    
    private Command getCmd(CommandResponseResult commandResponseResult) {
    
        ...
    }
}

```

1. CommandResponseHandler在初始化后将各种命令的响应结果对应的处理策略保存到map中
2. 收到命令响应后调用CommandResponseHandler中的onResponse方法处理
3. onResponse判断命令成功状态执行handleSuccessResponse或handleFailureResponse
4. 根据命令类型执行对应策略
