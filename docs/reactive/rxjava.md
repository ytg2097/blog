---
prev: ./
next: ./reactive-streams
sidebar: auto
---

# RxJava

RxJava是Reactive Extensions的java虚拟机实现. Reactive Extensions是一种工具, 能够命令式的处理数据流, 无论这个流是同步还是异步的. ReactiveX通常被定义为观察者模式, 迭代器, 函数式编程的组合.
本文内容基于RxJava2

##  观察者 + 迭代器 = 响应式流

传统的观察者模式中对某件事情感兴趣的观察者们会将自己注册到一个相关的主题上面, 当某个事件发生后我们会通过主题去通知订阅了这个主题的观察者. 

```java 
// 观察者
public interface Observer<T>{
    void notify(T event);
}

// 主题
public interface Subject<T>{
    void registerObserver(Observer<T> observer);
    void unregisterObserver(Observer<T> observer);
    void notifyAll(T event);
}
```

这种模式中我们不希望生产者在有消费者订阅之前发布事件. 在这一场景下, 我们可以结合迭代器模式来解决. 

```java 

// 这是一个典型的迭代器
public interface Iterator<T>{
    T next();
    boolean hasNext();
}    
// 迭代器模式结合观察者模式
public interface RxObserver<T>{
    void onNext(T next);
}

```
结合迭代器之后的消费者, 不再通过Iterator的next()方法获取事件, 而是通过onNext()回调接收一个新事件. 同时我们又希望生产者在生产者可以发出无线数据流的同时, 在某个时间点还可以向消费者发出一个数据流结束的信号. 以及
在处理next时发生错误时能够有一个错误传播机制. 因此我们需要再将Observer改造一下.

```java
public interface RxObserver<T>{
    void onNext(T next);
    void onComplete();
    void onError(Exception e);
}
```

改造之后的RxObserver定义了数据如何在响应式流中如何流动. 这就是RxJava的基本概念. RxJava提供了三个类来描述这种观察者模式

- Observable. 它对应了观察者模式中的Subject的对应类, 它扮演了事件源的角色.
- Subscriber. Subscriber抽象类实现了Observer接口并消费数据.
- Subscription. 控制Observable和Subscriber之间的运行时关系.  
> 在RxJava2中由于已经存在org.reactivestreams.Subscription(遵循Reactive Streams标准), 为避免名字冲突, 改名为 io.reactivex.disposables.Disposable 
 
![subscription](http://image.ytg2097.com/subscription.png)

RxJava定义了有关发送数据的规则, 是Observable能够发送任意数量的元素, 然后通过声明成功或引发错误来指示之行结束. 因此Observable会多次调用与它关联的每个Subscriber的onNext(), 然后再调用onComplete()或onError(). 

## RxJava的部分API

```java 
    @Test
    public void test() {

        Observable.create(sub -> {
            // 当一个订阅者出现是会立即触发
            sub.onNext("哈哈");
            sub.onComplete();
        }).subscribe(
                // onNext
                System.out::println,
                // onError
                System.out::println,
                // onComplete
                () -> System.out.println("结束")
        );

    }
```
上述代码中创建了一个由Observable表示的流. 在创建方法`create()`中传入一个回调, 当有订阅者出现时会触发这个回调. 这个回调会先生成一个字符串"哈哈"发送给订阅者, 然后调用结束信号`onComplete()`发送给订阅者.
`subscribe()`方法会向Observable中注册一个订阅者. 这个方法有多个重载.  

### Observable的多种创建方法

Observable在概念上分为冷热两类. 

冷Observable当有一个订阅者订阅时, 会**重新开始**发射数据给订阅者. 如果有多个订阅者同时订阅, 他们收到的数据是相互独立的. 当一个订阅者取消订阅时, 冷Observable会停止发送给这个订阅者,但不会停止想其他订阅者发送. 

热Observable是经过冷Observable的`publish()`方法和`reply(int n)`方法转换而来的. 如果使用`publish()`方法转换, 订阅者只能收到订阅之后发出的数据, 如果使用`reply(int n)`转换而来, 可以在订阅后收到在订阅之前发送的n个数据.
热Observable指的是ConnectableObservable. ConnectableObservable相当于是一个中介, 真正产生数据的还是冷Observable. 同时ConnectableObservable还可以通过`refCount()`或`autoConnect(int n)`再转换回Observable. 
通过`refCount()`转换回Observable, 转换回的Observable也是只有在订阅者只能收到订阅之后发出的数据, 但是如果订阅者为0时, Observable将会停止发送数据, 当有订阅者出现时才会继续. 

通过上述描述可以发现, 冷热Observable的最大区别是当订阅者出现时是否重新开始对其发射数据.

```java 
    @Test
    public void test_buildObserver() {

        // 使用just来引用一个元素
        Observable.just("哈哈")
                .subscribe(System.out::println);

        // 从数组中创建, 数组中的每个元素都会触发一次onNext
        Observable.fromArray(123, 456, 789)
                .subscribe(System.out::println);

        // 从callable构建
        Observable.fromCallable(() -> "小花哥")
                .subscribe(System.out::println);

        // 从future构建
        Observable.fromFuture(Executors.newCachedThreadPool().submit(() -> "heihei"))
                .subscribe(System.out::println);


        Observable<String> callable = Observable.fromCallable(() -> "callable");
        Observable<String> future = Observable.fromFuture(Executors.newCachedThreadPool().submit(() -> "future"));
        // 组合其他Observable构建
        Observable.concat(callable, future)
                .forEach(System.out::println);
                
        // Observable中还提供了很多方法用于创建Observable实例, 可以看源码        
    }
```

### 生成异步序列

```java 

    @Test
    public void test_asyncObserver() throws InterruptedException {

        // 每个一秒发布一个数据
        Observable.interval(1, TimeUnit.SECONDS)
                .subscribe(i -> System.out.println(i.getClass().getName() + " ----> " + i));
        // 由于生成事件及消费的过程在一个守护进程中, 所以需要主线程sleep等待
        Thread.sleep(5000);
    }
    
    // 控制台输出
    Connected to the target VM, address: '127.0.0.1:61468', transport: 'socket'
    java.lang.Long ----> 0
    java.lang.Long ----> 1
    java.lang.Long ----> 2
    java.lang.Long ----> 3
    java.lang.Long ----> 4
    Disconnected from the target VM, address: '127.0.0.1:61468', transport: 'socket'
```

### Disposable使用

Disposable中提供了`dispos()`方法用于取消订阅. 
```java 
    @Test
    public void test_subscription() throws InterruptedException {

        CountDownLatch latch = new CountDownLatch(1);

        Disposable disposable = Observable.interval(100, TimeUnit.MILLISECONDS)
                .subscribe(e -> {
                    System.out.println(e);
                    // 当收到八个元素后取消这个订阅
                    if (e != 0 && e % 7 == 0){
                        latch.countDown();
                    }
                });
        latch.await();
        disposable.dispose();
    }
```

## 操作符

操作符对于熟悉JDK8的同学很好理解

map转化操作
```java 

    // 
    @Test
    public void test_map(){

        Observable.just("小花哥")
                .map(before -> {
                    System.out.println("--- map ---");
                    return "花哥哥";
                })
                .subscribe(System.out::println);
    }
```
filter过滤操作
```java
    @Test
    public void test_filter(){

        Observable.fromArray(new Integer[]{1,3,5,8,9})
                .filter(e -> e % 3 == 0)
                .subscribe(System.out::println);
    }
```
zip操作用于合并两个并行流的值, 通常用于填充数据, 适用于部分预期结果从不同源获取的情况. 
```java 

    @Test
    public void test_zip(){

        Observable.zip(
                Observable.fromArray(1,3,5,8,9),
                Observable.fromArray("a","b"),
                (x,y) -> x + y
        ).subscribe(System.out::println);
    }
    
    // 控制台输出
    1a,
    3b
```

Observable还提供了数十个操作符, 可以查看源码

## 小Demo

实现一个小需求: 现有一个温度传感器, 每个一段时间会更新一个温度值推送给用户.

1. 新建一个spring-boot项目添加web依赖与rxjava依赖

```java 
    <dependencies>

        <dependency>
            <groupId>io.reactivex.rxjava2</groupId>
            <artifactId>rxjava</artifactId>
            <version>2.2.21</version>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
```
2. 新建温度传感器类

```java 

// 温度传感器类, 持有一个内部类Temperature用于保存温度值
public class TemperatureSensor{

    private final Random random = new Random();
    private final Observable<Temperature> dataStream = Observable
            // 1 创建一个具有Integer.MAX_VALUE大小的流
            .range(0,Integer.MAX_VALUE)  
            // 5 将转换后的温度值流连接
            .concatMap(e -> Observable           
                    // 2 创建一个只有一个元素的流     
                    .just(e)          
                    // 3 模拟随机延迟               
                    .delay(random.nextInt(5000), TimeUnit.MILLISECONDS)  
                    // 4 将这个单元素流中的值转换为温度值
                    .map(this::probe)                
            )
            // 6. 这一步是为了避免每个订阅者都触发新的流订阅和传感器读数序列
            .publish()               
            // 7. 当订阅者为0时, 不再发送数据可以进一步的节约温度传感器的资源                 
            .refCount();                             

    private Temperature probe(int i){
        return new Temperature(16 + random.nextGaussian() * 10);
    }

    public Observable<Temperature> tempStream(){
        return dataStream;
    }

    public final class Temperature{

        private final double val;

        public Temperature(double val) {
            this.val = val;
        }
        public double getVal() {
            return val;
        }
    }
}
```

2. 自定义SseEmitter

采用[Server-Sent Event](https://www.baeldung.com/spring-server-sent-events)的方式向客户端推送数据
```java 

 // 扩展spring 提供的SseEmitter, 加入自定义的Observer
 public class RxSeeEmitter extends SseEmitter {
 
     static final long SSE_SESSION_TIMEOUT = 30 * 60 * 1000L;
     final MyObserver observer;
 
     public RxSeeEmitter() {
         super(SSE_SESSION_TIMEOUT);
         this.observer = new MyObserver();
         onCompletion(observer::dispose);
         onTimeout(observer::dispose);
     }
 
     public class MyObserver implements Observer<TemperatureSensor.Temperature>{
 
         Disposable disposable;
 
         // 订阅后保存subscription
         @Override
         public void onSubscribe(@NonNull Disposable disposable) {
             this.disposable = disposable;
         }
 
         @Override
         public void onNext(TemperatureSensor.Temperature temperature) {
             try {
                 // 每接收到一个温度值都通过SseEmitter发送出去
                 RxSeeEmitter.this.send(temperature.getVal());
             } catch (IOException e) {
                 // 发送失败时取消订阅   
                 this.dispose();
             }
         }
 
         @Override
         public void onError(Throwable throwable) {
         }
 
         @Override
         public void onComplete() {
         }
 
         public void dispose(){
             if (disposable == null){
                 throw new IllegalStateException();
             }
             disposable.dispose();
         }
     }
 
     public MyObserver getObserver() {
         return observer;
     }
 }
 ```
3. 将自定义SseEmitter暴露出去

```java 
@RestController
public class TemperatureController {

    private final TemperatureSensor sensor;

    public TemperatureController(TemperatureSensor sensor) {
        this.sensor = sensor;
    }

    @GetMapping
    public SseEmitter events(){

        RxSeeEmitter seeEmitter = new RxSeeEmitter();
        sensor.tempStream()
                .subscribe(seeEmitter.getObserver());
        return seeEmitter;
    }
}
```
4. 配置`server.port=8099`, 然后启动访问可以看到

![sse](http://image.ytg2097.com/sse.png)

## RxJava的多种响应类型


- **Observable**: Observable不支持回压, 没有实现Publisher接口. 所以它不与响应式流规范直接兼容. 因此在将其用于大量元素的流时要注意. 不过它的`toFlowable`方法可以应用用户选择的背压策略将流转换为Flowable
- **Flowable**: Flowable实现了响应式流规范的Publisher接口.
- **Single**: 仅生成一个元素的流. 没有实现Publisher接口, 也具备`toFlowable`方法. 
- **Maybe**: 生成0个或一个元素的流. 没有实现Publisher接口, 也具备`toFlowable`方法.
- **Completable**: 不能产生onNext信号, 没有实现Publisher接口, 只能触发onError或onComplete信号. 
