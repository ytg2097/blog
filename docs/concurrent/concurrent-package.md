---
prev: ./lock
sidebar: auto
---

# Concurrent包

由于java的CAS同时具有volatile读和写内存语义. 因此java线程之间通信有四种方式

- **A线程写volatile变量, 随后B线程读这个volatile变量**
- **A线程写volatile变量, 随后B线程用CAS更新这个volatile变量**
- **A线程用CAS更新一个volatile变量, 随后B线程用CAS更新这个volatile变量**
- **A线程用CAS更新一个volatile变量, 随后B线程读这个volatile变量**

java的CAS会使用现代处理器上提供的高效机器级别的原子指令, 这些原子指令以原子方式对内存进行读-改-写操作, 这是多处理器中实现同步的关键. 
同时volatile变量的读/写和CAS可以实现线程之间的通信. 把这些特性整合到一起, 就形成了整个current包实现的基石. 看过current包源码后会发现, 有一个通用的实现模式.

首先, 声明共享变量为volatile. 

然后, 使用CAS的原子条件更新来实现线程之间的同步. 

同时, 配合以volatile的读/写和CAS所具有的volatile读写的内存语义来实现线程间通信. 

java中的AQS. 原子变量类, 非阻塞数据结构都是使用这种模式实现的. 而current包的高层类有依赖于这些基础类.

![curpackageimpl](../.vuepress/images/curpackageimpl.png)

## Executor

在JDK1.5之后, java将工作单元与执行机制分离开. 工作单元包括runnable和callable, 执行机制有Executor框架提供. 

![executor](../.vuepress/images/executor.png)

java多线程程序把任务分解为多个任务, 然后使用Executor把这些任务映射为固定数量的线程.

Executor框架分为三部分:

- **任务**. 包括被执行任务需要实现的接口: Runnable或Callable.
- **任务的执行**. 包括任务执行机制的和新街口Executor, 以及继承了Executor的ExecutorService接口. Executor框架有两个关键类实现了ExecutorService接口(ThreadPoolExecutor和ScheduledThreadPoolExecutor)
- **异步执行结果**. 包括接口Future和实现类FutureTask.

Executors的工厂方法.
| 方法名| 描述|
| --- | --- |
| newFixedThreadPool| 创建一个固定长度的线程池, 每提交一个任务时就创建一个线程, 当到达长度时, 规模不再变化|
| newCachedThreadPool| 可缓存的线程池, 如果线程池的规模超过了处理需求时, 会回收空闲的线程, 当需求增加时, 会添加新的线程来处理需求, 线程池规模不存在限制|
| newScheduledThreadPool| 创建一个固定长度的线程池, 以延迟或定时的方式来执行任务|
| newSingleThreadPool| 单线程线程池, 可以确保依照任务在队列中的执行顺序(FIFO,LIFO,优先级)|


ExecutorService的方法
| 方法名| 描述| 
|shutdown|平缓关闭, 不再接受新任务, 同时等待已提交的任务执行完毕, 包括还未执行的任务|
|shutdownNow| 立刻关闭, 并返回未执行的任务|
|isShutDown|当调用shutdown或shutdownNow后返回true|
|isTerminated| 调用shutdown后, 并且所提交的任务完成后返回true; 调用shutdownNot后, 成功停止后返回true|

关闭后提交的任务将由拒绝执行处理器来处理. 

### 延迟任务与周期任务

::: warning Timer
Timer在执行所有定时任务时只会创建一个线程, 如果某个任务的执行任务时间过长会影响其他TimerTask的定时精确性.

如果TimeTask抛出了一个未检查的异常, Timer不会捕获异常, 这时会终止定时线程, 并且不会恢复, 而是会错误的认为整个Timer都被取消了, 因此已经被调度但未执行的TimerTask将不会执行, 新的任务也不会被调度,
这种情况成为**线程泄露**
:::

ScheduledThreadPoolExecutor内部使用DelayQueue提供调度功能.

DelayQueue内部使用PriorityQueue存放数据, 使用ReentrantLock实现线程同步.DelayQueue中的每个元素都要实现Delayed接口, 每个Delayed对象都有一个相应的延迟时间. 
在DelayQueue中, 只有元素逾期之后, 才会被take.

```java 

        ScheduledThreadPoolExecutor executor = new ScheduledThreadPoolExecutor(2,runnable -> new Thread(runnable,"scheduled-thread-"));

        executor.scheduleAtFixedRate(() -> System.out.println("1秒之后开始执行; 下次任务执行时间 = 本次任务开始时间 + 1秒"),1000, 1, TimeUnit.SECONDS);
        executor.scheduleWithFixedDelay(() -> System.out.println("1秒之后开始执行;下次任务执行时间 = 本次任务结束时间 + 1秒"),1000,1,TimeUnit.SECONDS );
        executor.schedule(() -> System.out.println("一秒后执行一次任务"), 1000, TimeUnit.SECONDS);
        ScheduledFuture<String> future = executor.schedule(() -> {
            System.out.println("执行callable任务");
            return "success";
        }, 1000, TimeUnit.SECONDS);
        // 如果任务执行结束, 获取结果
        if (future.isDone()){
            System.out.println(future.get());
        }
    } 
```
![scheduledThreadPoolExecutor](../.vuepress/images/scheduledThreadPoolExecutor.png)

DelayQueue中的PriorityQueue会对队列中的ScheduledFutureTask进行排序, 排序时, time小的排在前面, 任务优先执行, 如果time相等, 会将入队时间较早的task放在前面. 

当ScheduledThreadPoolExecutor中的某个线程取到并执行一个任务之后, 会把这个task的time变量修改为下次将要被执行的时间, 修改之后会将任务重新放回队列中.

### CompletionService

当提交一组计算任务, 并希望在计算完成后获得结果时可以使用CompletionService. 

CompletionService将Executor和BlockingQueue融合, 将Callable和Runnable提交过后, 使用类似于队列操作的take和poll来获得已完成的结果.

```java 
    @Test
    void test_completionService() throws ExecutionException, InterruptedException {

        ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(0,Integer.MAX_VALUE,60 , TimeUnit.SECONDS, new SynchronousQueue<>());
        CompletionService<String> completionService = new ExecutorCompletionService<>(threadPoolExecutor);

        completionService.submit(() -> "success");
        completionService.submit(() -> "success");
        ...

        Future<String> future = completionService.take();

        assert Objects.equals(future.get(), "success");
    }
```

ExecutorCompletionService实现了CompletionService, 它在构造函数中创建一个BlockingQueue保存计算的结果, 当计算完成时调用FutureTask的done方法, 当提交任务时, 首先将任务包装为一个QueueingFuture, 它实现了
FutureTask, 并重写了done方法, 将结果放入BlockingQueue中. 多个ExecutorCompletionService可以共用一个Executor 

## 同步容器类

current包内基于CAS与volatile构建了一系列的并发容器. 如ConcurrentHashMap, ConcurrentSkipListMap(SortedMap线程安全版)和ConcurrentSkipListSet(SortedSet线程安全版). Queue, DeDeque接口及其实现类等.  

### Queue

Queue用于保存一组待处理的数据, 它不会阻塞, 如果队列为空, 获取元素的操作将返回null. 

Queue有几个常用的子类:

> - 
>
>

### Deque

### CopyOnWriterArrayList


### ConcurrentHashMap

在并发变成中HashMap不能保证线程安全, 而使用线程安全的HashTable效率过于低下, 于是出现了ConcurrentHashMap, 它用于替代同步且基于散列的Map, 它采用分段锁来实现更大程度的共享. 

HashTable效率底下的原因是因为内部只有一把synchronized, 所有线程要去竞争. 而ConcurrentHashMap内部中有多把锁, 每一把锁用于锁容器其中一部分数据, 当多线程访问不同数据段的数据时, 线程间就不会存在锁竞争, 从而有效提高并发访问效率. 

![concurrenthashmap](../.vuepress/images/concurrenthashmap.png)

CurrentHashMap有Segment数组结构和HashEntry数组结构组成. Segment继承了ReentrantLock. HashEntry用于存储键值对.Segment结构类似于HashMap, 是数组和链表结构. 一个Segment守护一个HashEntry数组里的元素. 
  
![concurrenthashmap-structure](../.vuepress/images/concurrenthashmap-structure.png) 

对一个HashEntry数组的数据进行修改时, 必须先获得与他对应的Segment锁.

::: tip ConcurrencyLevel

 ConcurrentHashMap初始化除initialCapacity与loadFactor之外还需要一个ConcurrencyLevel参数(预计的并发更新线程数), 这个参数用于决定segments数组的长度
::: 


### Fork/Join框架


## 闭锁

## 信号量

## 栅栏

