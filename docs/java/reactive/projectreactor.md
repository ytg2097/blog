---
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

Mono定义一个最多可产生一个元素的流. 

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

### 生成流

这是一种同步的逐个产生值的方法. 
```java 
    @Test
    public void test_generate(){

        Flux.generate(
                // 初始化一个状态变量
                () -> 1,
                // 改变状态
                (state,sink) -> {
                    // 生成下个元素
                    sink.next("3 x " + state + " = " + 3 * state);
                    if (state == 10){
                        sink.complete();
                    }
                    // 返回新状态
                    return state + 1;
                },
                // finally 消费状态
                state -> System.out.println("state = " + state))
                .subscribe(System.out::println);
    }
```

### 异步创建流

与generate不同的是, 它的生成方式既可以同步也可以异步, 还可以每次发出多个元素. 同时create不需要状态值. 
```java 
    interface MyEventListener<T> {
        void onDataChunk(List<T> chunk);
        void processComplete();
    }

    @Test
    public void test_create(){

        Flux<String> bridge = Flux.create(sink -> {
            myEventProcessor.register(
                    new MyEventListener<String>() {

                        public void onDataChunk(List<String> chunk) {
                            for(String s : chunk) {
                                // 可以多次调用next方法生成元素
                                sink.next(s);
                            }
                        }

                        public void processComplete() {
                            sink.complete();
                        }
                    });
        });
    }
```

上述代码中sink的next与complete都是在myEventProcessor异步执行的.

同时create方法还可以提供背压策略. 
```java 
    
	enum OverflowStrategy {
		
		// 完全忽略下游背压请求，这可能会在下游队列积满的时候导致 IllegalStateException。
		IGNORE,
        // 当下游跟不上节奏的时候发出一个 IllegalStateException 的错误信号。
		ERROR,
		// 当下游没有准备好接收新的元素的时候抛弃这个元素。
		DROP,
		// 让下游只得到上游最新的元素。
		LATEST,
		// （默认的）缓存所有下游没有来得及处理的元素（这个不限大小的缓存可能导致 OutOfMemoryError）。
		BUFFER
	}    
	public static <T> Flux<T> create(Consumer<? super FluxSink<T>> emitter, OverflowStrategy backpressure) {
		return onAssembly(new FluxCreate<>(emitter, backpressure, FluxCreate.CreateMode.PUSH_PULL));
	}
```

::: tip 注意
Mono 也有一个用于 create 的生成器（generator）—— MonoSink，它不能生成多个元素， 因此会抛弃第一个元素之后的所有元素。
::: 
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



### 创建一个新序列

- 发出一个 T，我已经有了：just

    - 基于一个 Optional&lt;T&gt;：Mono#justOrEmpty(Optional&lt;T&gt;)

    - 基于一个可能为 null 的 T：Mono#justOrEmpty(T)

- 发出一个 T，且还是由 just 方法返回

    - 但是“懒”创建的：使用 Mono#fromSupplier 或用 defer 包装 just

- 发出许多 T，这些元素我可以明确列举出来：Flux#just(T...)

- 基于迭代数据结构:

    - 一个数组：Flux#fromArray

    - 一个集合或 iterable：Flux#fromIterable

    - 一个 Integer 的 range：Flux#range

    - 一个 Stream 提供给每一个订阅：Flux#fromStream(Supplier&lt;Stream&gt;)

- 基于一个参数值给出的源：

    - 一个 Supplier&lt;T&gt;：Mono#fromSupplier

    - 一个任务：Mono#fromCallable，Mono#fromRunnable

- 一个 CompletableFuture&lt;T&gt;：Mono#fromFuture

- 直接完成：empty

- 立即生成错误：error

    - 但是“懒”的方式生成 Throwable：error(Supplier&lt;Throwable&gt;)

- 什么都不做：never

    - 订阅时才决定：defer

- 依赖一个可回收的资源：using

- 可编程地生成事件（可以使用状态）:

    - 同步且逐个的：Flux#generate

    - 异步（也可同步）的，每次尽可能多发出元素：Flux#create （Mono#create 也是异步的，只不过只能发一个）

###  对序列进行转化

- 我想转化一个序列：

    - 1对1地转化（比如字符串转化为它的长度）：map

    - ​类型转化：cast

    - ​为了获得每个元素的序号：Flux#index

    - 1对n地转化（如字符串转化为一串字符）：flatMap + 使用一个工厂方法

    - 1对n地转化可自定义转化方法和/或状态：handle

    - 对每一个元素执行一个异步操作（如对 url 执行 http 请求）：flatMap + 一个异步的返回类型为 Publisher 的方法

    - ​忽略一些数据：在 flatMap lambda 中根据条件返回一个 Mono.empty()

    - ​保留原来的序列顺序：Flux#flatMapSequential（对每个元素的异步任务会立即执行，但会将结果按照原序列顺序排序）

    - ​当 Mono 元素的异步任务会返回多个元素的序列时：Mono#flatMapMany

- 我想添加一些数据元素到一个现有的序列：

    - 在开头添加：Flux#startWith(T...)

    - 在最后添加：Flux#concatWith(T...)

    - 我想将 Flux 转化为集合（一下都是针对 Flux 的）

    - 转化为 List：collectList，collectSortedList

    - 转化为 Map：collectMap，collectMultiMap

    - 转化为自定义集合：collect

    - 计数：count

    - reduce 算法（将上个元素的reduce结果与当前元素值作为输入执行reduce方法，如sum） reduce

        - ​将每次 reduce 的结果立即发出：scan

    - 转化为一个 boolean 值：

        - 对所有元素判断都为true：all

        - 对至少一个元素判断为true：any

        - 判断序列是否有元素（不为空）：hasElements

        - 判断序列中是否有匹配的元素：hasElement

- 我想合并 publishers

    - 按序连接：Flux#concat 或 .concatWith(other)

        - ​即使有错误，也会等所有的 publishers 连接完成：Flux#concatDelayError

        - ​按订阅顺序连接（这里的合并仍然可以理解成序列的连接）：Flux#mergeSequential

    - 按元素发出的顺序合并（无论哪个序列的，元素先到先合并）：Flux#merge / .mergeWith(other)

        - ​元素类型会发生变化：Flux#zip / Flux#zipWith

    - 将元素组合：

        - 2个 Monos 组成1个 Tuple2：Mono#zipWith

        - n个 Monos 的元素都发出来后组成一个 Tuple：Mono#zip

    - 在终止信号出现时“采取行动”

        - 在 Mono 终止时转换为一个 Mono&lt;Void&gt;：Mono#and

        - 当 n 个 Mono 都终止时返回 Mono&lt;Void&gt;：Mono#when

        - 返回一个存放组合数据的类型，对于被合并的多个序列：

            - 每个序列都发出一个元素时：Flux#zip

            - 任何一个序列发出元素时：Flux#combineLatest

    - 只取各个序列的第一个元素：Flux#first，Mono#first，mono.or (otherMono).or(thirdMono)，`flux.or(otherFlux).or(thirdFlux)

    - 由一个序列触发（类似于 flatMap，不过“喜新厌旧”）：switchMap

    - 由每个新序列开始时触发（也是“喜新厌旧”风格）：switchOnNext

- 我想重复一个序列：repeat

    - 但是以一定的间隔重复：Flux.interval(duration).flatMap(tick -&gt; myExistingPublisher)

    - 我有一个空序列，但是…​
        
        - 我想要一个缺省值来代替：defaultIfEmpty

        - 我想要一个缺省的序列来代替：switchIfEmpty

    - 我有一个序列，但是我对序列的元素值不感兴趣：ignoreElements

        - ​并且我希望用 Mono 来表示序列已经结束：then

        - ​并且我想在序列结束后等待另一个任务完成：thenEmpty

        - ​并且我想在序列结束之后返回一个 Mono：Mono#then(mono)

        - ​并且我想在序列结束之后返回一个值：Mono#thenReturn(T)

        - ​并且我想在序列结束之后返回一个 Flux：thenMany

    - 我有一个 Mono 但我想延迟完成…​

        - 当有1个或N个其他 publishers 都发出（或结束）时才完成：Mono#delayUntilOther

            - ​使用一个函数式来定义如何获取“其他 publisher”：Mono#delayUntil(Function)

    - 我想基于一个递归的生成序列的规则扩展每一个元素，然后合并为一个序列发出：

        - ​广度优先：expand(Function)

        - ​深度优先：expandDeep(Function)

### “窥视”（只读）序列

- 再不对序列造成改变的情况下，我想：

    - 得到通知或执行一些操作：

        - 发出元素：doOnNext

        - 序列完成：Flux#doOnComplete，Mono#doOnSuccess

        - 因错误终止：doOnError

        - 取消：doOnCancel

        - 订阅时：doOnSubscribe

        - 请求时：doOnRequest

        - 完成或错误终止：doOnTerminate（Mono的方法可能包含有结果）

            - 但是在终止信号向下游传递 之后 ：doAfterTerminate

        - 所有类型的信号（Signal）：Flux#doOnEach

        - 所有结束的情况（完成complete、错误error、取消cancel）：doFinally

    - 记录日志：log

- 我想知道所有的事件:

    - 每一个事件都体现为一个 single 对象：

        - 执行 callback：doOnEach

        - 每个元素转化为 single 对象：materialize

            - ​在转化回元素：dematerialize

    - 转化为一行日志：log

### 过滤序列

- 我想过滤一个序列

    - 基于给定的判断条件：filter

        - ​异步地进行判断：filterWhen

    - 仅限于指定类型的对象：ofType

    - 忽略所有元素：ignoreElements

    - 去重:

        - 对于整个序列：Flux#distinct

        - 去掉连续重复的元素：Flux#distinctUntilChanged

- 我只想要一部分序列：

    - 只要 N 个元素：

        - 从序列的第一个元素开始算：Flux#take(long)

            - ​取一段时间内发出的元素：Flux#take(Duration)

            - ​只取第一个元素放到 Mono 中返回：Flux#next()

            - ​使用 request(N) 而不是取消：Flux#limitRequest(long)

        - 从序列的最后一个元素倒数：Flux#takeLast

        - 直到满足某个条件（包含）：Flux#takeUntil（基于判断条件），Flux#takeUntilOther（基于对 publisher 的比较）

        - 直到满足某个条件（不包含）：Flux#takeWhile

    - 最多只取 1 个元素：

        - 给定序号：Flux#elementAt

        - 最后一个：.takeLast(1)

            - ​如果为序列空则发出错误信号：Flux#last()

            - ​如果序列为空则返回默认值：Flux#last(T)

    - 跳过一些元素：

        - 从序列的第一个元素开始跳过：Flux#skip(long)

            - ​跳过一段时间内发出的元素：Flux#skip(Duration)

        - 跳过最后的 n 个元素：Flux#skipLast

        - 直到满足某个条件（包含）：Flux#skipUntil（基于判断条件），Flux#skipUntilOther （基于对 publisher 的比较）

        - 直到满足某个条件（不包含）：Flux#skipWhile

    - 采样：

        - 给定采样周期：Flux#sample(Duration)

            - 取采样周期里的第一个元素而不是最后一个：sampleFirst

        - 基于另一个 publisher：Flux#sample(Publisher)

        - 基于 publisher“超时”：Flux#sampleTimeout （每一个元素会触发一个 publisher，如果这个 publisher 不被下一个元素触发的 publisher 覆盖就发出这个元素）

- 我只想要一个元素（如果多于一个就返回错误）…​

    - 如果序列为空，发出错误信号：Flux#single()

    - 如果序列为空，发出一个缺省值：Flux#single(T)

    - 如果序列为空就返回一个空序列：Flux#singleOrEmpty

### 错误处理
- 我想创建一个错误序列：error…​

    - 替换一个完成的 Flux：.concat(Flux.error(e))

    - ​替换一个完成的 Mono：.then(Mono.error(e))

    - ​如果元素超时未发出：timeout

    - ​“懒”创建：error(Supplier&lt;Throwable&gt;)

- 我想要类似 try/catch 的表达方式：

    - 抛出异常：error

    - 捕获异常：

        - 然后返回缺省值：onErrorReturn

        - 然后返回一个 Flux 或 Mono：onErrorResume

        - 包装异常后再抛出：.onErrorMap(t -&gt; new RuntimeException(t))

    - finally 代码块：doFinally

    - Java 7 之后的 try-with-resources 写法：using 工厂方法

- 我想从错误中恢复…

    - 返回一个缺省的：

        - 的值：onErrorReturn

        - Publisher：Flux#onErrorResume 和 Mono#onErrorResume

    - 重试：retry

        - ​由一个用于伴随 Flux 触发：retryWhen

- 我想处理回压错误（向上游发出“MAX”的 request，如果下游的 request 比较少，则应用策略）…​

    - 抛出 IllegalStateException：Flux#onBackpressureError

    - 丢弃策略：Flux#onBackpressureDrop

        - ​但是不丢弃最后一个元素：Flux#onBackpressureLatest

    - 缓存策略（有限或无限）：Flux#onBackpressureBuffer

        - ​当有限的缓存空间用满则应用给定策略：Flux#onBackpressureBuffer 带有策略 BufferOverflowStrategy

### 基于时间的操作
- 我想将元素转换为带有时间信息的 Tuple2&lt;Long, T&gt;…​

    - 从订阅时开始：elapsed

    - 记录时间戳：timestamp

- 如果元素间延迟过长则中止序列：timeout

- 以固定的周期发出元素：Flux#interval

- 在一个给定的延迟后发出 0：static Mono.delay.

- 我想引入延迟：

    - 对每一个元素：Mono#delayElement，Flux#delayElements

    - 延迟订阅：delaySubscription

### 拆分 Flux
- 我想将一个 Flux&lt;T&gt; 拆分为一个 Flux&lt;Flux&lt;T&gt;&gt;：

    - 以个数为界：window(int)

        - ​会出现重叠或丢弃的情况：window(int, int)

    - 以时间为界：window(Duration)

        - ​会出现重叠或丢弃的情况：window(Duration, Duration)

    - 以个数或时间为界：windowTimeout(int, Duration)

    - 基于对元素的判断条件：windowUntil

        - ​触发判断条件的元素会分到下一波（cutBefore 变量）：.windowUntil(predicate, true)
        - ​满足条件的元素在一波，直到不满足条件的元素发出开始下一波：windowWhile （不满足条件的元素会被丢弃）

    - 通过另一个 Publisher 的每一个 onNext 信号来拆分序列：window(Publisher)，windowWhen

- 我想将一个 Flux&lt;T&gt; 的元素拆分到集合…​

    - 拆分为一个一个的 List:

        - 以个数为界：buffer(int)

            - ​会出现重叠或丢弃的情况：buffer(int, int)

        - 以时间为界：buffer(Duration)

            - ​会出现重叠或丢弃的情况：buffer(Duration, Duration)

        - 以个数或时间为界：bufferTimeout(int, Duration)

        - 基于对元素的判断条件：bufferUntil(Predicate)

            - ​触发判断条件的元素会分到下一个buffer：.bufferUntil(predicate, true)

            - ​满足条件的元素在一个buffer，直到不满足条件的元素发出开始下一buffer：bufferWhile(Predicate)

        - 通过另一个 Publisher 的每一个 onNext 信号来拆分序列：buffer(Publisher)，bufferWhen

    - 拆分到指定类型的 "collection"：buffer(int, Supplier&lt;C&gt;)

- 我想将 Flux&lt;T&gt; 中具有共同特征的元素分组到子 Flux：groupBy(Function&lt;T,K&gt;) TIP：注意返回值是 Flux&lt;GroupedFlux&lt;K, T&gt;&gt;，每一个 GroupedFlux 具有相同的 key 值 K，可以通过 key() 方法获取。

### 回到同步的世界
- 我有一个 Flux&lt;T&gt;，我想：

    - 在拿到第一个元素前阻塞：Flux#blockFirst

        - ​并给出超时时限：Flux#blockFirst(Duration)

    - 在拿到最后一个元素前阻塞（如果序列为空则返回 null）：Flux#blockLast

        - ​并给出超时时限：Flux#blockLast(Duration)

    - 同步地转换为 Iterable&lt;T&gt;：Flux#toIterable

    - 同步地转换为 Java 8 Stream&lt;T&gt;：Flux#toStream

- 我有一个 Mono&lt;T&gt;，我想：

    - 在拿到元素前阻塞：Mono#block

        - ​并给出超时时限：Mono#block(Duration)

    - 转换为 CompletableFuture&lt;T&gt;：Mono#toFuture
## 调度器

Reactor， 就像 RxJava，也可以被认为是 并发无关（concurrency agnostic） 的。意思就是， 它并不强制要求任何并发模型。更进一步，它将选择权交给开发者。不过，它还是提供了一些方便 进行并发执行的库。

在 Reactor 中，执行模式以及执行过程取决于所使用的 Scheduler。 Scheduler 是一个拥有广泛实现类的抽象接口。 Schedulers 类提供的静态方法用于达成如下的执行环境：

- 当前线程（`Schedulers.immediate()`）

- 可重用的单线程（`Schedulers.single()`）。注意，这个方法对所有调用者都提供同一个线程来使用， 直到该调度器（Scheduler）被废弃。如果你想使用专一的线程，就对每一个调用使用 `Schedulers.newSingle()`。

- 弹性线程池（`Schedulers.elastic()`。它根据需要创建一个线程池，重用空闲线程。线程池如果空闲时间过长 （默认为 60s）就会被废弃。对于 I/O 阻塞的场景比较适用。 `Schedulers.elastic()` 能够方便地给一个阻塞 的任务分配它自己的线程，从而不会妨碍其他任务和资源，见 如何包装一个同步阻塞的调用？。

- 固定大小线程池（`Schedulers.parallel()`）。所创建线程池的大小与 CPU 个数等同。

此外，你还可以使用 `Schedulers.fromExecutorService(ExecutorService)` 基于现有的 ExecutorService 创建 Scheduler。你也可以使用 newXXX 方法来创建不同的调度器。比如 `Schedulers.newElastic(yourScheduleName)` 创建一个新的名为 yourScheduleName 的弹性调度器。

&gt; 操作符基于非阻塞算法实现，从而可以利用到某些调度器的工作窃取（work stealing） 特性的好处。

一些操作符默认会使用一个指定的调度器（通常也允许开发者调整为其他调度器）例如， 通过工厂方法 Flux.interval(Duration.ofMillis(300)) 生成的每 300ms 打点一次的 Flux&lt;Long&gt;， 默认情况下使用的是 Schedulers.parallel()，下边的代码演示了如何将其装换为 Schedulers.single()：

```java 
Flux.interval(Duration.ofMillis(300), Schedulers.newSingle("test"))
```

Reactor 提供了两种在响应式链中调整调度器 Scheduler 的方法：`publishOn` 和 `subscribeOn`。 它们都接受一个 Scheduler 作为参数，从而可以改变调度器。但是 publishOn 在链中出现的位置 是有讲究的，而 subscribeOn 则无所谓。要理解它们的不同，你首先要理解 **nothing happens until you subscribe()**。

在 Reactor 中，当你在操作链上添加操作符的时候，你可以根据需要在 Flux 和 Mono 的实现中包装其他的 Flux 和 Mono。一旦你订阅（subscribe）了它，一个 Subscriber 的链 就被创建了，一直向上到第一个 publisher 。这些对开发者是不可见的，开发者所能看到的是最外一层的 Flux （或 Mono）和 Subscription，但是具体的任务是在中间这些跟操作符相关的 subscriber 上处理的。

基于此，我们仔细研究一下 publishOn 和 subscribeOn 这两个操作符：

- publishOn 的用法和处于订阅链（subscriber chain）中的其他操作符一样。它将上游 信号传给下游，同时执行指定的调度器 Scheduler 的某个工作线程上的回调。 它会 **改变后续的操作符的执行所在线程** （直到下一个 publishOn 出现在这个链上）。

- subscribeOn 用于订阅（subscription）过程，作用于那个向上的订阅链（发布者在被订阅 时才激活，订阅的传递方向是向上游的）。所以，无论你把 subscribeOn 至于操作链的什么位置， 它都会影响到源头的线程执行环境（context）。 但是，它不会影响到后续的 publishOn，后者仍能够切换其后操作符的线程执行环境。

&gt; 只有操作链中最早的 subscribeOn 调用才算数

## 线程模型

Flux 和 Mono 不会创建线程。一些操作符，比如 publishOn，会创建线程。同时，作为一种任务共享形式， 这些操作符可能会从其他任务池（work pool）——如果其他任务池是空闲的话——那里“偷”线程。因此， 无论是 Flux、Mono 还是 Subscriber 都应该精于线程处理。它们依赖这些操作符来管理线程和任务池。

publishOn 强制下一个操作符（很可能包括下一个的下一个…​）来运行在一个不同的线程上。 类似的，subscribeOn 强制上一个操作符（很可能包括上一个的上一个…​）来运行在一个不同的线程上。 记住，在你订阅（subscribe）前，你只是定义了处理流程，而没有启动发布者。基于此，Reactor 可以使用这些规则来决定如何执行操作链。然后，一旦你订阅了，整个流程就开始工作了。

下边的例子演示了支持任务共享的多线程模型：
```java 
//创建一个有 10,000 个元素的 Flux。
Flux.range(1, 10000) 
    //创建等同于 CPU 个数的线程（最小为4）。
    // subscribe() 之前什么都不会发生。
    .publishOn(Schedulers.parallel()) 
    .subscribe(result) 
```

Scheduler.parallel() 创建一个基于单线程 ExecutorService 的固定大小的任务线程池。 因为可能会有一个或两个线程导致问题，它总是至少创建 4 个线程。然后 publishOn 方法便共享了这些任务线程， 当 publishOn 请求元素的时候，会从任一个正在发出元素的线程那里获取元素。这样， 就是进行了任务共享（一种资源共享方式）。Reactor 还提供了好几种共享资源的方式，请参考 Schedulers。

Scheduler.elastic() 也能创建线程，它能够很方便地创建专门的线程（以便跑一些可能会阻塞资源的任务， 比如一个同步服务），如`Mono.fromCallable`

内部机制保证了这些操作符能够借助自增计数器（incremental counters）和警戒条件（guard conditions） 以线程安全的方式工作。例如，如果我们有四个线程处理一个流（就像上边的例子），每一个请求会让计数器自增， 这样后续的来自不同线程的请求就能拿到正确的元素。

## 高级特性

### 打包复用操作符

1. 使用transform操作符

transform 操作符可以将一段操作链封装为一个函数式（function）。这个函数式能在操作期（assembly time） 将被封装的操作链中的操作符还原并接入到调用 transform 的位置。这样做和直接将被封装的操作符 加入到链上的效果是一样的。示例如下：
```java 
Function<Flux<String>, Flux<String>> filterAndMap =
f -> f.filter(color -> !color.equals("orange"))
      .map(String::toUpperCase);

Flux.fromIterable(Arrays.asList("blue", "green", "orange", "purple"))
        .doOnNext(System.out::println)
        .transform(filterAndMap)
        .subscribe(d -> System.out.println("Subscriber to Transformed MapAndFilter: "+d));
控制台输出
blue
Subscriber to Transformed MapAndFilter: BLUE
green
Subscriber to Transformed MapAndFilter: GREEN
orange
purple
Subscriber to Transformed MapAndFilter: PURPLE        
```
2. 使用compose操作符

compose 操作符与 transform 类似，也能够将几个操作符封装到一个函数式中。 主要的区别就是，这个函数式作用到原始序列上的话，是 基于每一个订阅者的（on a per-subscriber basis） 。这意味着它对每一个 subscription 可以生成不同的操作链（通过维护一些状态值）。 如下例所示：

```java 
AtomicInteger ai = new AtomicInteger();
Function<Flux<String>, Flux<String>> filterAndMap = f -> {
        if (ai.incrementAndGet() == 1) {
return f.filter(color -> !color.equals("orange"))
        .map(String::toUpperCase);
        }
        return f.filter(color -> !color.equals("purple"))
                .map(String::toUpperCase);
};

Flux<String> composedFlux =
Flux.fromIterable(Arrays.asList("blue", "green", "orange", "purple"))
    .doOnNext(System.out::println)
    .compose(filterAndMap);

composedFlux.subscribe(d -> System.out.println("Subscriber 1 to Composed MapAndFilter :"+d));
composedFlux.subscribe(d -> System.out.println("Subscriber 2 to Composed MapAndFilter: "+d));
控制台输出
blue
Subscriber 1 to Composed MapAndFilter :BLUE
green
Subscriber 1 to Composed MapAndFilter :GREEN
orange
purple
Subscriber 1 to Composed MapAndFilter :PURPLE
blue
Subscriber 2 to Composed MapAndFilter: BLUE
green
Subscriber 2 to Composed MapAndFilter: GREEN
orange
Subscriber 2 to Composed MapAndFilter: ORANGE
purple
```

### Hot vs Cold

到目前为止，我们一直认为 Flux（和 Mono）都是这样的：它们都代表了一种异步的数据序列， 在订阅（subscribe）之前什么都不会发生。

但是实际上，广义上有两种发布者：“热”与“冷”（hot and cold）。

（本文档）到目前介绍的其实都是 cold 家族的发布者。它们为每一个订阅（subscription） 都生成数据。如果没有创建任何订阅（subscription），那么就不会生成数据。

试想一个 HTTP 请求：每一个新的订阅者都会触发一个 HTTP 调用，但是如果没有订阅者关心结果的话， 那就不会有任何调用。

另一方面，热 发布者，不依赖于订阅者的数量。即使没有订阅者它们也会发出数据， 如果有一个订阅者接入进来，那么它就会收到订阅之后发出的元素。对于热发布者， 在你订阅它之前，确实已经发生了什么。

just 是 Reactor 中少数几个“热”操作符的例子之一：它直接在组装期（assembly time） 就拿到数据，如果之后有谁订阅它，就重新发送数据给订阅者。再拿 HTTP 调用举例，如果给 just 传入的数据是一个 HTTP 调用的结果，那么之后在初始化 just 的时候才会进行唯一的一次网络调用。

如果想将 just 转化为一种 冷 的发布者，你可以使用 defer。它能够将刚才例子中对 HTTP 的请求延迟到订阅时（这样的话，对于每一个新的订阅来说，都会发生一次网络调用）。

::: tip Note
Reactor 中多数其他的 热 发布者是扩展自 Processor 的。
::: 

考虑其他两个例子，如下是第一个例子：
```java 
Flux<String> source = Flux.fromIterable(Arrays.asList("blue", "green", "orange", "purple"))
                          .doOnNext(System.out::println)
                          .filter(s -> s.startsWith("o"))
                          .map(String::toUpperCase);

source.subscribe(d -> System.out.println("Subscriber 1: "+d));
source.subscribe(d -> System.out.println("Subscriber 2: "+d));
控制台输出
blue
green
orange
Subscriber 1: ORANGE
purple
blue
green
orange
Subscriber 2: ORANGE
purple
```
两个订阅者都触发了所有的颜色，因为每一个订阅者都会让构造 Flux 的操作符运行一次。

将下边的例子与第一个例子对比：
```java 
UnicastProcessor<String> hotSource = UnicastProcessor.create();

Flux<String> hotFlux = hotSource.publish()
                                .autoConnect()
                                .map(String::toUpperCase);


hotFlux.subscribe(d -> System.out.println("Subscriber 1 to Hot Source: "+d));

hotSource.onNext("blue");
hotSource.onNext("green");

hotFlux.subscribe(d -> System.out.println("Subscriber 2 to Hot Source: "+d));

hotSource.onNext("orange");
hotSource.onNext("purple");
hotSource.onComplete();
控制台输出
Subscriber 1 to Hot Source: BLUE
Subscriber 1 to Hot Source: GREEN
Subscriber 1 to Hot Source: ORANGE
Subscriber 2 to Hot Source: ORANGE
Subscriber 1 to Hot Source: PURPLE
Subscriber 2 to Hot Source: PURPLE
```
第一个订阅者收到了所有的四个颜色，第二个订阅者由于是在前两个颜色发出之后订阅的， 故而收到了之后的两个颜色，在输出中有两次 "ORANGE" 和 "PURPLE"。从这个例子可见， 无论是否有订阅者接入进来，这个 Flux 都会运行。

### 广播

有时候，你不仅想要延迟到某一个订阅者订阅之后才开始发出数据，可能还希望在多个订阅者 到齐 之后 才开始。

ConnectableFlux 的用意便在于此。Flux API 中有两种主要的返回 ConnectableFlux 的方式：publish 和 replay。

- publish 会尝试满足各个不同订阅者的需求（背压），并综合这些请求反馈给源。 尤其是如果有某个订阅者的需求为 0，publish 会 暂停 它对源的请求。

- replay 将对第一个订阅后产生的数据进行缓存，最多缓存数量取决于配置（时间/缓存大小）。 它会对后续接入的订阅者重新发送数据。

ConnectableFlux 提供了多种对下游订阅的管理。包括：

- connect 当有足够的订阅接入后，可以对 flux 手动执行一次。它会触发对上游源的订阅。

- autoConnect(n) 与 connect 类似，不过是在有 n 个订阅的时候自动触发。

- refCount(n) 不仅能够在订阅者接入的时候自动触发，还会检测订阅者的取消动作。如果订阅者数量不够， 会将源“断开连接”，再有新的订阅者接入的时候才会继续“连上”源。

- refCount(int, Duration) 增加了一个 "优雅的倒计时"：一旦订阅者数量太低了，它会等待 Duration 的时间，如果没有新的订阅者接入才会与源“断开连接”。

示例如下:

```java 
Flux<Integer> source = Flux.range(1, 3)
                           .doOnSubscribe(s -> System.out.println("subscribed to source"));

ConnectableFlux<Integer> co = source.publish();

co.subscribe(System.out::println, e -> {}, () -> {});
co.subscribe(System.out::println, e -> {}, () -> {});

System.out.println("done subscribing");
Thread.sleep(500);
System.out.println("will now connect");

co.connect();

控制台输出
done subscribing
will now connect
subscribed to source
1
1
2
2
3
3
```

使用autoConnect:

```java
Flux<Integer> source = Flux.range(1, 3)
                           .doOnSubscribe(s -> System.out.println("subscribed to source"));

Flux<Integer> autoCo = source.publish().autoConnect(2);

autoCo.subscribe(System.out::println, e -> {}, () -> {});
System.out.println("subscribed first");
Thread.sleep(500);
System.out.println("subscribing second");
autoCo.subscribe(System.out::println, e -> {}, () -> {});
控制台输出
subscribed first
subscribing second
subscribed to source
1
1
2
2
3
3
```

### 批处理

当你有许多的元素，并且想将他们分批处理，Reactor 总体上有三种方案：分组（grouping）、 窗口（windowing）（译者注：感觉这个不翻译更明白。。。）、缓存（buffering）。 这三种在概念上类似，因为它们都是将 Flux&lt;T&gt; 进行聚集。分组和分段操作都会创建一个 Flux&lt;Flux&lt;T&gt;&gt;，而缓存操作得到的是一个 Collection&lt;T&gt;（译者注：应该是一个 Flux&lt;Collection&lt;T&gt;&gt;)。

1. 用 Flux&lt;GroupedFlux&lt;T&gt;&gt; 进行分组

分组能够根据 key 将源 Flux&lt;T&gt; 拆分为多个批次。

对应的操作符是 groupBy。

每一组用 GroupedFlux&lt;T&gt; 类型表示，使用它的 key() 方法可以得到该组的 key。

在组内，元素并不需要是连续的。当源发出一个新的元素，该元素会被分发到与之匹配的 key 所对应的组中（如果还没有该 key 对应的组，则创建一个）。

这意味着组：

    1. 是互相没有交集的（一个元素只属于一个组）。
    2. 会包含原始序列中任意位置的元素。
    3. 不会为空。
    
```java 
StepVerifier.create(
        Flux.just(1, 3, 5, 2, 4, 6, 11, 12, 13)
                .groupBy(i -> i % 2 == 0 ? "even" : "odd")
                .concatMap(g -> g.defaultIfEmpty(-1) //如果组为空，显示为 -1
                                .map(String::valueOf) //转换为字符串
                                .startWith(g.key())) //以该组的 key 开头
        )
        .expectNext("odd", "1", "3", "5", "11", "13")
        .expectNext("even", "2", "4", "6", "12")
        .verifyComplete();
```    
::: warning 注意
分组操作适用于分组个数不多的场景。而且所有的组都必须被消费，这样 groupBy 才能持续从上游获取数据。有时候这两种要求在一起——比如元素数量超多， 但是并行的用来消费的 flatMap 又太少的时候——会导致程序卡死。
::: 

2. 使用 Flux&lt;Flux&lt;T&gt;&gt; 进行 window 操作
window 操作是 根据个数、时间等条件，或能够定义边界的发布者（boundary-defining Publisher）， 把源 Flux&lt;T&gt; 拆分为 windows。

对应的操作符有 window、windowTimeout、windowUntil、windowWhile，以及 windowWhen。

与 groupBy 的主要区别在于，窗口操作能够保持序列顺序。并且同一时刻最多只能有两个 window 是开启的。

它们 可以 重叠。操作符参数有 maxSize 和 skip，maxSize 指定收集多少个元素就关闭 window，而 skip 指定收集多数个元素后就打开下一个 window。所以如果 maxSize &gt; skip 的话， 一个新的 window 的开启会先于当前 window 的关闭， 从而二者会有重叠。

重叠的 window 示例如下
```java 
StepVerifier.create(
        Flux.range(1, 10)
                .window(5, 3) //overlapping windows
                .concatMap(g -> g.defaultIfEmpty(-1)) //将 windows 显示为 -1
        )
                .expectNext(1, 2, 3, 4, 5)
                .expectNext(4, 5, 6, 7, 8)
                .expectNext(7, 8, 9, 10)
                .expectNext(10)
                .verifyComplete();
```
::: tip 注意
如果将两个参数的配置反过来（maxSize &lt; skip），序列中的一些元素就会被丢弃掉， 而不属于任何 window。
::: 

对基于判断条件的 windowUntil 和 windowWhile，如果序列中的元素不匹配判断条件， 那么可能导致 空 windows，如下例所示：
```java 
StepVerifier.create(
        Flux.just(1, 3, 5, 2, 4, 6, 11, 12, 13)
                .windowWhile(i -> i % 2 == 0)
                .concatMap(g -> g.defaultIfEmpty(-1))
        )
                .expectNext(-1, -1, -1) //分别被奇数 1 3 5 触发
                .expectNext(2, 4, 6) // 被 11 触发
                .expectNext(12) // 被 13 触发
                .expectNext(-1) // 空的 completion window，如果 onComplete 前的元素能够匹配上的话就没有这个了
                .verifyComplete();
```

3. 使用 Flux&lt;List&lt;T&gt;&gt; 进行缓存
缓存与窗口类似，不同在于：缓存操作之后会发出 buffers （类型为`Collection&lt;T&gt;， 默认是 `List&lt;T&gt;)，而不是 windows （类型为 Flux&lt;T&gt;）。

缓存的操作符与窗口的操作符是对应的：buffer、bufferTimeout、bufferUntil、bufferWhile， 以及`bufferWhen`。

如果说对于窗口操作符来说，是开启一个窗口，那么对于缓存操作符来说，就是创建一个新的集合， 然后对其添加元素。而窗口操作符在关闭窗口的时候，缓存操作符则是发出一个集合。

缓存操作也会有丢弃元素或内容重叠的情况，如下：
```java 
StepVerifier.create(
        Flux.range(1, 10)
                .buffer(5, 3) // 缓存重叠
        )
                .expectNext(Arrays.asList(1, 2, 3, 4, 5))
                .expectNext(Arrays.asList(4, 5, 6, 7, 8))
                .expectNext(Arrays.asList(7, 8, 9, 10))
                .expectNext(Collections.singletonList(10))
                .verifyComplete();
```
不像窗口方法，bufferUntil 和 bufferWhile 不会发出空的 buffer，如下例所示：
```java
StepVerifier.create(
        Flux.just(1, 3, 5, 2, 4, 6, 11, 12, 13)
                .bufferWhile(i ->; i % 2 == 0)
        )
        .expectNext(Arrays.asList(2, 4, 6)) // 被 11 触发
        .expectNext(Collections.singletonList(12)) // 被 13 触发
        .verifyComplete();
```
### 并行处理
如今多核架构已然普及，能够方便的进行并行处理是很重要的。Reactor 提供了一种特殊的类型 ParallelFlux 来实现并行，它能够将操作符调整为并行处理方式。

你可以对任何 Flux 使用 parallel() 操作符来得到一个 ParallelFlux. 不过这个操作符本身并不会进行并行处理，而是将负载划分到多个“轨道（rails）”上 （默认情况下，轨道个数与 CPU 核数相等）。

为了配置 ParallelFlux 如何并行地执行每一个轨道，你需要使用 runOn(Scheduler)。 注意，Schedulers.parallel() 是推荐的专门用于并行处理的调度器。
下边有两个用于比较的例子，第一个如下：
```java 
Flux.range(1, 10)
    .parallel(2) 
    .subscribe(i -> System.out.println(Thread.currentThread().getName() + " -> " + i));
控制台输出
main -> 1
main -> 2
main -> 3
main -> 4
main -> 5
main -> 6
main -> 7
main -> 8
main -> 9
main -> 10
```
下边是第二个例子：
```java 
Flux.range(1, 10)
    .parallel(2)
    .runOn(Schedulers.parallel())
    .subscribe(i -> System.out.println(Thread.currentThread().getName() + " -> " + i));
控制台输出    
parallel-1 -> 1
parallel-2 -> 2
parallel-1 -> 3
parallel-2 -> 4
parallel-1 -> 5
parallel-2 -> 6
parallel-1 -> 7
parallel-1 -> 9
parallel-2 -> 8
parallel-2 -> 10
```

如果在并行地处理之后，需要退回到一个“正常”的 Flux 而使后续的操作链按非并行模式执行， 你可以对 ParallelFlux 使用 sequential() 方法。

注意，当你在对 ParallelFlux 使用一个 Subscriber 而不是基于 lambda 进行订阅（subscribe()） 的时候，sequential() 会自动地被偷偷应用。

注意 `subscribe(Subscriber<T>)` 会合并所有的执行轨道，而 `subscribe(Consumer<T>)` 会在所有轨道上运行。
如果 subscribe() 方法中是一个 lambda，那么有几个轨道，lambda 就会被执行几次。

你还可以使用 groups() 作为 `Flux<GroupedFlux<T>>` 进入到各个轨道或组里边， 然后可以通过 composeGroup() 添加额外的操作符。
