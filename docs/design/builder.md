---
prev: ./clone
---

# 建造者模式

建造者模式用于将多个简单对象通过组装的方式构建出一个复杂对象. 他保证了复杂对象的在构建时能够有一个清晰的层次.

我们在开发中会经常接触到建造者模式, 如StringBuilder, StringBuffer. 或lombok提供的@Builder注解. 

![builder](../.vuepress/images/builder.png)

建造者模式中有三个角色:

- **抽象的建造者Builder**: 定义了建造者建造目标对象的各种行为.
- **实际的建造者ConcreteBuilder**: 实现了Builder.
- **被建造对象T**


## 示例

需求: 项目中需要有对接网络摄像头的功能, 需要编写一个工具类用于向其他的摄像头云平台(这里是萤石云)的open api发送请求

这里我们使用建造者模式拼装http请求参数. 

::: tip Tip
设计模式的使用并不要求必须遵循固定的规则, 可以灵活应用. 
:::

### 抽象出请求参数基类
```java 

public abstract class AbstractParam {

    // 本次请求的目标url
    public abstract String url();

    // 存储本次请求中的所有参数项
    protected final Set<ParamItem> paramItems = newHashSet();

    // 发送http请求之前需要调用此方法校验参数项中是否有必填却为空的参数项
    void valid(){

        Optional<ParamItem> selfCheckFailedItem = paramItems.stream().filter(ParamItem::selfCheck).findFirst();
        if (selfCheckFailedItem.isPresent()){
            throw new IllegalArgumentException(format("%s not be null", selfCheckFailedItem.get().getKey()));
        }
    }

    // 设置否个参数项的value
    public void setItemValue(String key,Object value){

        for (ParamItem item : paramItems) {

            if (item.getKey().equals(key)){
                item.setValue(value);
                break;
            }
        }
    }

    public String body() {

        if (paramItems.isEmpty()) {
            return "";
        }
        return paramItems.stream().filter(item -> nonNull(item.getValue())).map(item -> item.getKey() + "=" + item.getValue()).collect(Collectors.joining("&"));
    }
}
```

### 通用的请求参数项类

```java 
public class ParamItem {
    
    // 请求参数项key    如http://xxx.com?searchkey=某某某   key即searchkey
    private String key;
    // 请求参数项的value 如http://xxx.com?searchkey=某某某   value即某某某
    private Object value;
    // 参数是否必须
    private Boolean require;

    public ParamItem(String key,  Boolean require) {
        this.key = key;
        this.require = require;
    }

    private ParamItem(){}

    public String getKey() {
        return key;
    }

    public Object getValue() {
        return value;
    }

    public void setValue(Object value) {
        this.value = value;
    }


    public Boolean selfCheck(){

        return this.require && isNull(value);
    }

    // 重写equals与hashcode方法, 比较请求参数项是否相同时, 以key为准
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ParamItem paramItem = (ParamItem) o;
        return Objects.equals(key, paramItem.key);
    }

    @Override
    public int hashCode() {
        return Objects.hash(key);
    }
}
```

### 定义建造者能力接口

```java 
// 泛型限定这个建造者只为请求参数服务
public interface Builder<T extends AbstractParam> {

    default T build(){
        // 实际建造之前先校验参数
        instance().valid();
        // 校验通过后返回示例
        return instance();
    }

    // 获取ConcreteBuilder持有的被建造者示例
    T instance();
}

```

### 被建造者与建造者

这里以发起摄像头的云台控制命令为例. 编写一个请求参数(被建造者)与参数构造器(建造者)

```java 
// 继承请求参数基类
public class PtzStartParam extends AbstractParam {

    
    private final String URL = "https://open.ys7.com/api/lapp/device/ptz/start";

    // 对外暴露Builder
    public static PtzStartParam.PtzStartParamBuilder builder() {

        return new PtzStartParamBuilder();
    }

    @Override
    public String url() {
        return URL;
    }

    // 私有构造, 创建实例入口交由Builder管理
    // 初始化本次请求的所有参数
    private PtzStartParam(){

        paramItems.add(new ParamItem("accessToken",TRUE));
        paramItems.add(new ParamItem("deviceSerial",TRUE));
        paramItems.add(new ParamItem("channelNo",TRUE));
        paramItems.add(new ParamItem("direction",TRUE));
        paramItems.add(new ParamItem("speed",TRUE));
    }

    public static class PtzStartParamBuilder implements Builder<PtzStartParam> {

        // 持有一个被建造者实例
        private final PtzStartParam instance = new PtzStartParam();

        /**
         * @param accessToken 访问令牌
         * @return
         */
        public PtzStartParamBuilder accessToken(String accessToken){

            instance.setItemValue("accessToken",accessToken);
            return this;
        }

        /**
         * @param deviceSerial 设备序列号
         * @return
         */
        public PtzStartParamBuilder deviceSerial(String deviceSerial){

            instance.setItemValue("deviceSerial",deviceSerial);
            return this;
        }

        /**
         * @param channelNo 通道号
         * @return
         */
        public PtzStartParamBuilder channelNo(Integer channelNo){

            instance.setItemValue("channelNo",channelNo);
            return this;
        }

        /**
         * @param direction 云台动作
         * @return
         */
        public PtzStartParamBuilder direction(DirectionEnum direction){

            instance.setItemValue("direction",direction.getCode());
            return this;
        }

        /**
         * @param speed 云台动作速度
         * @return
         */
        public PtzStartParamBuilder speed(SpeedEnum speed){

            instance.setItemValue("speed",speed.getCode());
            return this;
        }

        @Override
        public PtzStartParam instance() {
            return instance;
        }
    }
}

```

### 配套的基础设施

```java 
public class PtzRestClient {

    /**
     * 开始云台控制
     * 对设备进行开始云台控制，开始云台控制之后必须先调用停止云台控制接口才能进行其他操作，包括其他方向的云台转动
     * @param param
     * @return
     */
    public static Result ptzStart(PtzStartParam param) {

        return ResultFactory.toResult(RetryHttpClient.post(param),null);
    }
    ... 
}    

public class RetryHttpClient {

   private static Logger LOGGER = LoggerFactory.getLogger(RetryHttpClient.class);
   ...
    public static String post(AbstractParam param) {

        try {
            return HttpClient.httpPostSyn(param.url(), param.body(),TRUE);
        } catch (Exception e) {
            LOGGER.error(e.getMessage());
            return null;
        }
    }
}

public final class HttpClient {

    private static final MediaType FORM = MediaType.parse("application/x-www-form-urlencoded");
    
    public static String httpPostSyn(String url,String param,boolean retry) throws IOException {
        
        // 实际使用okhttp进行http请求
        OkHttpClient okHttpClient = getOkHttpClient(retry);
        RequestBody body = RequestBody.create(FORM, param);
        Request request = new Request.Builder()
                .url(url)
                .post(body)
                .build();
        Response response = okHttpClient.newCall(request).execute();
        return response.body().string();
    }    

    private static OkHttpClient getOkHttpClient(boolean retry) {

        OkHttpClient.Builder httpBuilder = new OkHttpClient.Builder();
        httpBuilder.readTimeout(60, TimeUnit.SECONDS)
                .connectTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS);
        if (retry) {
            httpBuilder.addInterceptor(new RetryInterceptor());
        }
        return httpBuilder.build();
    }    

    public static class RetryInterceptor implements Interceptor {

        private static final int MAX_RETRY_COUNT = 2;
        private int retryCount;

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            Response response = chain.proceed(request);
            while (!response.isSuccessful() && retryCount < MAX_RETRY_COUNT) {
                retryCount++;
                response = chain.proceed(request);
            }
            return response;
        }
    }    
}


```

### 单元测试

```java 
    @Test
    public void ptzStart() {

        PtzStartParam build = PtzStartParam.builder()
                .deviceSerial(deviceSerial)
                .accessToken(accessToken)
                .channelNo(1)
                .direction(DirectionEnum.TOP)
                .speed(SpeedEnum.MODERATE)
                .build();
        Result result = PtzRestClient.ptzStart(build);
    }
```
 
