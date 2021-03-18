---
prev: ./reactive-streams
sidebar: auto
---
# Project Reactor

Reactor库由Spring推出, 并且Spring5的响应性也是基于Reactor实现. 在前两篇文章中我们已经知道, 回压是响应式流
中必不可少的一个属性, Reactor库实现了响应式流规范, 所以回压是Reactor本身的核心主题. 

Reactor支持所有常见的回压传播模式:

- 仅推送: 当订阅者通过subscription.request(Long.MAX_VALUE)请求无限数量的元素时.
- 仅拉取: 当订阅者通过subscription.request(1)仅在收到前一个元素后请求下一个元素时.
- 推拉混合: 当订阅者有实时控制需求, 且发布者可以适应消费者所提出的数据消费速度时.

## Flux与Mono 

我们已经知道响应式流规范定义的四个接口中`Publisher<T>`作为发布者的角色. Reactor提供了`Publisher<T>`接口的两种实现即`Flux<T>`和`Mono<T>`. 

Flux定义了一个普通的响应式流, 它可以产生0个, 1个 ,多个元素或者无限个元素. 

Mono定一个一个最多可产生一个元素的流. 

Flux与Mono之间可以相互转换, 如使用`mono.repeat()`返回Flux, 使用`flux.collectList()`返回Mono. 同时它还可以优化一些不改变语义的转换. 如`Mono.from(Flux.from(mono))`返回原始的mono实例.

## 创建与订阅

### 立即创建流

```java 

    @Test
    public void test_factoryMethod(){

        String[] array = {"小", "花", "哥"};

        Flux<String> just = Flux.just(array[0], array[1], array[2]);
        Flux<String> fromArray = Flux.fromArray(array);
        Flux<String> fromIterable = Flux.fromIterable(Arrays.asList(array));

        // 生成数字流  从2021开始, 生成5个   2021,2022,2023,2024,2025
        Flux<Integer> range = Flux.range(2021, 5);

        Mono<Object> fromOptional = Mono.justOrEmpty(Optional.empty());
        Mono<Void> fromRunnable = Mono.fromRunnable(() -> System.out.println("ReactorTest.test_factoryMethod"));
        Mono<String> fromSupplier = Mono.fromSupplier(() -> "小花哥");
        // 异步的发出Http请求
        Mono<String> fromCallable = Mono.fromCallable(this::httpRequest);
    }

    private String httpRequest(){

        // 同步阻塞的http请求
        return "HTTP Response";
    }

    @Test
    public void test_emptyMethod(){

        // 只发布complete信号的流
        Flux<Object> emptyFLux = Flux.empty();
        // 只传error信号的流
        Flux<Object> errorFlux = Flux.error(() -> new RuntimeException("错误"));
        // 不包含任何消息通知的流, 没有complete信号也没有error信号
        Flux<Object> neverFlux = Flux.never();
    }
```

### 延迟创建流

```java 
    @Test
    public void test_defer(){

        Mono<String> mono = deferMono(true);
    }
    
    private Mono<String> deferMono(boolean flag){
        
        // Mono的实际创建时间延迟到每次发生订阅之后.
        return Mono.defer(() -> flag? Mono.just("flag == true") : Mono.just(" flag == false"));
    }
```

### 周期生成无限流

```java 
    @Test
    public void test_interval() throws InterruptedException {

        Disposable disposable = Flux.interval(Duration.ofMillis(10))
                .subscribe(e -> System.out.println("Received data ---> " + e));

        // 与rxjava一样   事件的发布与消费是在单独的守护线程中
        Thread.sleep(1000);

        disposable.dispose();
    }
```

### 订阅流

Flux与Mono提供了一系列重载的接收lambda的subscribe方法. 除接收Subscription参数的重载方法之外, 他们都会在订阅
之后发出`request(Long.MAX_VALUE)`请求. 

```java 
    
    @Test
    public void test_subscribe(){

        Mono<String> mono = Mono.just("hello","world");

        // 无限制消费数据
        mono.subscribe(System.out::println);
        // 无限制消费数据, 并可以处理error
        mono.subscribe(System.out::println,Throwable::printStackTrace);
        // 无限制消费数据, 并可以处理error和complete
        mono.subscribe(System.out::println,Throwable::printStackTrace, () -> System.out.println("completed"));
        // 订阅后请求消费一个数据,而后取消订阅 
        mono.subscribe(
                System.out::println,
                Throwable::printStackTrace,
                () -> System.out.println("completed"),
                subscription -> {subscription.request(1)});
        // 同上
        mono.subscribe(new Subscriber<String>() {
            @Override
            public void onSubscribe(Subscription s) {
                s.request(1);
            }

            @Override
            public void onNext(String s) {
                System.out.println(s);
            }

            @Override
            public void onError(Throwable t) {
                t.printStackTrace();
            }

            @Override
            public void onComplete() {
                System.out.println("completed");
            }
        });
    }

```

::: warning 注意
如果订阅者在流完成之前取消了订阅, 那么订阅者将不会收到complete信号
::: 

::: danger 注意

不要在onSubscribe调用 subscription.cancel(). 会导致cancel()之前的request(n)失效. onNext会一个元素也接收不到

```java 
            @Override
            public void onSubscribe(Subscription s) {

                subscription = s;
                s.request(10);
                s.cancel();
            }
```
:::

## 操作符

### 转换

映射转换 
```java 
    @Test
    public void test_map(){

        Flux<String> map = Flux.range(1, 5)
                // 与JDK8的stream的map一样
                .map(Integer::toBinaryString);
        Flux<Long> flux = Flux.range(1, 5)
                // 实际内部使用了map操作符
                .cast(Long.class);
    }
    
	public final <E> Flux<E> cast(Class<E> clazz) {
		Objects.requireNonNull(clazz, "clazz");
		return map(clazz::cast);
	}
```

--- 

枚举

```java 
    @Test
    public void test_enumerate(){

        Flux.range(0,5)
                .timestamp()
                .index()
                .subscribe(System.out::println);
    }
    
    控制台打印如下:
    [0,[1616060876362,0]]
    [1,[1616060876364,1]]
    [2,[1616060876364,2]]
    [3,[1616060876364,3]]
    [4,[1616060876364,4]]
```

index()方法会返回一个Flux<Tuple2<Long,T>>. Tuple是一种数据结构, reactor实现了它, 从Tuple2到Tuple8.
timestamp()方法会为每个元素添加一个时间戳. 

--- 

过滤

- filter. 与jdk中stream的filter一样
- ignoreElements
```java 
    @Test
    public void test_ignoreElements(){

        Flux.range(0,5)
                // 忽略所有元素
                .ignoreElements()
                .subscribe(System.out::println);
    }
```
- take(n) 忽略前n个元素之外的所有元素
```java 
    @Test
    public void test_take(){

        Flux.range(0,5)
                // 只取前2个
                .take(2)
                .subscribe(System.out::println);
    }
```
- takeLast() 只取最后一个元素

- takeUntil(Predicate) 
```java 
    @Test
    public void test_takeUntil(){

        Flux.range(0,5)
                // 获取元素直到某个元素符合条件, 之后的全部忽略
                .takeUntil(e -> e == 3)
                .subscribe(System.out::println);
    }
    控制台输出:
    0
    1
    2
    3
```

### 查看序列处理

### 查询聚合Flux

### 处理事件

### 同步返回数据

