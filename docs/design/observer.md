---
prev: ./iterator
next: ./agent
---

# 观察者模式

观察者模式中有三个主要的概念: 被观察者, 观察者, 被观察者关心的事件. 

![observer](http://image.ytg2097.com/observer.png)

被观察者可以接受一个观察者的订阅, 也可以取消一个观察者的订阅. 当某个事件发生时, 被观察者可以主动的去通知对这个事件感兴趣的观察者

我们常用的消息代理中间件, Spring提供的EventListener, VUE的数据驱动机制都可以找到观察者模式影子. 响应式编程更是基于观察者模式实现而来. 

## 示例 

需求: IOT平台中大都会有一个规则引擎的功能, 它在接受设备上报数据之后会依据本次上报数据值触发一系列动作. 如触发报警, 触发反向控制命令等等. 


### 1. 定义一个主题基类

```java 
public abstract class Subject<E extends Enum<E>,M> {
    
    // 使用Map来保存某个事件与观察者们的关系
    private final Map<Enum<E>, List<Listener<M>>> listeners = newConcurrentMap();

    // 添加一个对某个事件感兴趣的观察者
    protected void add(E event,Listener<M> listener){

        if (!listeners.containsKey(event)){
            listeners.put(event,newArrayList());
        }
        listeners.get(event).add(listener);
    }

    // 移除一个观察者
    protected void remove(E event,Listener listener){

        listeners.get(event).remove(listener);
    }

    // 通知一批观察者, 某个事件已经发生
    protected void notifyAll(Enum<E> event, M msg){

        for (Listener<M> listener : listeners.get(event)) {
            listener.onMessage(msg);
        }
    }
}
```

我们在一般场景中使用观察者模式时, 定义Subject类通常时一个接口, 接口中描述了对某一个事件感兴趣的观察者的一系列操作方法. 不过在特定场景下, 我们的观察者可能对某一个事物的多种状态变化或者说事件都感兴趣, 那么我们就
可以使用抽象类的方式, 在基类中统一管理观察者. 可以避免类爆炸的情况发生. 

### 2. 定义一个观察者基类
```java 
public interface Listener<MSG> {

    void onMessage(MSG message);
}
```

观察者基类的定义非常简单, 只有一个方法. 用于处理Subject发布的事件. 

### 3. 定义消息上下文类

由于我们的需求中会依据规则引擎触发不同的事件, 所以我们封装一个MessageContext类来传递触发规则的各种元素
```java 
@Getter
public class MessageContext {

    // 触发规则的设备id
    private String deviceId;
    // 本次上报数据经过解析后的json格式
    private JsonNode data;
    // 对应的规则引擎
    private RuleEngine engine;

    public MessageContext(RuleEngine engine,JsonNode data,String deviceId){

        this.engine = engine;
        this.data = data;
        this.deviceId = deviceId;
    }
}
``` 

### 4. 定义触发器

我们的规则引擎中, 当设备上报值触发某个条件时, 可能需要发送告警, 触发反向命令, 消息转发等操作, 这里我们以触发告警, 并发送通知为例实现一个告警触发器. 

```java 
@Component
@RequiredArgsConstructor
public class AlarmTrigger extends Subject<NotifyType,Alarm> implements Listener<MessageContext> {

    private final AlarmService alarmService;

    @PostConstruct
    public void addListener(){
        
        // 添加邮件观察者
        add(NotifyType.EMAIL,SpringUtil.getBean(EmailNotifyListener.class));
        // 添加短信观察者
        add(NotifyType.MSG,SpringUtil.getBean(MsgNotifyListener.class));
        // 添加站内信观察者
        add(NotifyType.INNER,SpringUtil.getBean(InnerNotifyListener.class));
    }

    /**
    * 实现告警信息的处理
    */
    @Override
    public void onMessage(MessageContext message) {
        
        // 1. 将触发的告警信息落库
        // 2. 通知告警信息观察者
        // 本次示例中简化操作, 向所有的告警观察者发送通知
        notifyAll(saveAlarm(message));
    }

    /**
     * 通知监听器
     * @param alarmList
     */
    private void notifyAll(List<Alarm> alarmList) {

        for (Alarm alarm : alarmList) {
            notifyAll(alarm.getNotifyType(),alarm);
        }
    }

    /**
     * 保存告警
     * @param message
     * @return
     */
    private List<Alarm> saveAlarm(MessageContext message) {

        return alarmService.persist(message.getDeviceId(), message.getData(), message.getEngine().getEngineId());
    }

    // 抽象一个告警通知基类, 接受的消息是 告警
    public abstract class AbstractNotifyListener implements Listener<Alarm>{
    }

    @Component
    public class EmailNotifyListener extends AbstractNotifyListener{

        @Override
        public void onMessage(Alarm message) {
            // 发送邮件
        }
    }

    @Component
    public class MsgNotifyListener extends AbstractNotifyListener{

        @Override
        public void onMessage(Alarm message) {
            // 发送短信
        }
    }

    @Component
    public class InnerNotifyListener extends AbstractNotifyListener{

        @Override
        public void onMessage(Alarm message) {
            // 生成站内信
        }
    }
}
```

上面的代码中AlarmTrigger不仅实现了Listener接口, 还继承了Subject类, 它同时具备观察者与被观察者两种身份. 这是因为在实际的业务场景中. 当告警触发, 我们除了要将告警信息保存到数据库中之外, 通常还会以邮件, 短信等方式
实时的通知设备负责人. 这里我们将这一系列的由告警触发的操作进一步剥离, 又提取出了`EmailNotifyListener`,`MsgNotifyListener`,`InnerNotifyListener`. 实现了告警信息保存与通知操作的分离. 优化了代码结构.

--- 

### 5. 定义动作执行器, 由规则引擎调用. 

```java 
@Component
public class ActionExecutor extends Subject<ActionExecutor.Event, MessageContext>{

    public enum Event {
        // 告警
        ALARM,
        // 消息转发
        FORWARD,
        // 反向命令
        CMD,
        // 工单
        ORDER
    }

    @PostConstruct
    public void initTriggerList(){

        add(Event.ALARM,SpringUtil.getBean(AlarmTrigger.class));
        add(Event.FORWARD,SpringUtil.getBean(ForwardTrigger.class));
        add(Event.CMD,SpringUtil.getBean(ActionTrigger.class));
        add(Event.ORDER,SpringUtil.getBean(OrderTrigger.class));
    }
}
```

### 6. 测试

```java 
    @Test
    public void test(){

        RuleEngine ruleEngine = ...
        JsonNode data = ...
        MessageContext messageContext = new MessageContext(ruleEngine,data,"123");
        actionExecutor.notifyAll(ActionExecutor.Event.ALARM,messageContext);
    } 
```




