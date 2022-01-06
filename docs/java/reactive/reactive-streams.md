---
prev: ./rxjava
next: ./projectreactor
sidebar: auto
---
# 响应式流

## 推 与 拉

### 拉模型
在响应式编程的早期, 所有库的设计思想都是把数据从源头推送到订阅者. 原因是拉模型在某些场景下效率不够高. 比如在一个有网络边界的系统中进行网络通讯. 如数据库请求. 

现在假设要从数据库中过滤出一部分数据, 只取前10个. 采用拉模型的方式如下: 

```java 
public class PullAndPush {

    class Item{
        private final Long id;

        public Item(Long id) {
            this.id = id;
        }

        public Long getId() {
            return id;
        }
    }

    interface AsyncDataBaseClient<T>{
        CompletionStage<T> store(CompletionStage<T> stage);
        CompletionStage<T> getNextAfterId(Long id);
    }

    private final AsyncDataBaseClient<Item> client = new AsyncDataBaseClient<Item>() {
        @Override
        public CompletionStage<Item> store(CompletionStage<Item> stage) {
            return null;
        }

        @Override
        public CompletionStage<Item> getNextAfterId(Long id) {
            return  CompletableFuture.supplyAsync(() -> new Item(id + 1));
        }
    };

    // 异步请求数据库, 当storage被填满时, future进入complete状态
    public CompletionStage<Queue<Item>> list(int count){

        BlockingQueue<Item> storage = new ArrayBlockingQueue<>(count);

        CompletableFuture<Queue<Item>> result = new CompletableFuture<>();

        pull(1L,storage,result,count);
        return result;
    }

    private void pull(Long elementId, BlockingQueue<Item> queue, CompletableFuture<Queue<Item>> result, int count) {

      client.getNextAfterId(elementId)
              .thenAccept(item -> {
                  // 从数据库中取出一个元素放到queue中
                  queue.offer(item);
                  if (queue.size() == count){
                      // 如果当前queue的size满足当前请求元素数量. 发出结束信号
                      result.complete(queue);
                      return;
                  }
                  // queue未满, 继续获取下个元素填充queue
                  pull(item.getId(),queue,result,count);
              });

    }
}
```

在上述代码中, 业务服务与数据库之间采用了异步非阻塞的交互机制. 但是它是有缺陷的. 

![pull](http://image.ytg2097.com/pull.png)

在逐个请求元素的过程中会导致整个请求的处理时间大部分浪费在业务服务的空闲等待上. 同时数据库不知道未来请求的数量, 意味着数据库不能提前生成数据, 因此在处于空闲状态, 等待新请求.
 
---

为了优化整体的执行过程, 我们加入批处理操作

```java 
public class PullAndPush {

    class Item{...}

    interface AsyncDataBaseClient<T>{
        ...
        CompletionStage<List<T>> getNextBatchAfterId(Long id, int count);
    }

    private final AsyncDataBaseClient<Item> client = new AsyncDataBaseClient<Item>() {
        
        ...
        
        @Override
        public CompletionStage<List<Item>> getNextBatchAfterId(Long id, int count) {
            return CompletableFuture.supplyAsync(() ->
                IntStream.rangeClosed(0,count)
                .mapToObj(i -> new Item(id + i))
                .collect(Collectors.toList())
            );
        }
    };

    ...
    
    private void pull(Long elementId, BlockingQueue<Item> queue, CompletableFuture<Queue<Item>> result, int count) {


      client.getNextBatchAfterId(elementId,count)
              .thenAccept(items -> {
                  for (Item item : items) {
                      
                      queue.offer(item);
                      if (queue.size() == count){
                          result.complete(queue);
                          return;
                      }
                  }
                  pull(items.get(items.size() - 1).getId(),queue,result,count - queue.size());
              });
    }
}
```

加入批处理的操作可以显著的减少整体请求的空闲时间, 但仍存在一些缺陷. 

![pull-batch](http://image.ytg2097.com/pull-batch.png)

数据库在进行检索数据时, 业务服务仍然需要空闲等待. 同时数据库批量发送数据比发送单个数据需要更多时间. 

### 推模型

我们的最终优化目标: 只请求一次数据, 当数据可用时, 数据源会异步推送数据.

```java 

public Observable<Item> list(int count){
    return client.getStreamOfItems()
    // 根据请求获取固定数量的数据
    .take(count);
}
```

执行流程如下:

![rxjavadb-push](http://image.ytg2097.com/rxjavadb-push.png)

经过这个小demo可以看出, 推模型可以将请求量降低到最小来优化整体的处理事件.  这也就是为什么RxJava以及类似的响应式类库为什么以推送数据为目地进行设计, 为什么流技术能成为分布式系统中组件之间重要的通信技术. 

但如果仅仅是与推模型组合, 也是有局限性的. 消息驱动的本质是每个请求都有一个响应, 因此服务可能收到异步的潜在的无线消息流. 如果生产者不关心消费者的吞吐能力, 可能会产生其他的缺陷如**慢生产者与快消费者**或**快生产者与慢消费者**. 


- 慢生产者与快消费者. 
> 某些业务场景中, 生产者可能对未知的消费者有一些偏好设置(或者说生产者认为消费者应该是这样的), 这是一种特定的业务假设. 另外在运行中, 消费者可能会动态变化. 这个问题解决的关键是明确真实需求. 但是在推模型无法解决这个问题.
- 快生产者与慢消费者. 
> 指的是生产者发送数据的速度远超过消费者的处理能力, 这种情况的一个解决方案是消费者将未处理的元素收集到队列中. 在使用队列时, 需要选择合适的队列, 尽量不要使用无界队列, 因为无界队列的无限制特性, 应用程序的回弹性将会降低, 比如内存占用问题.
> 
> 可以选择有界丢弃队列. 有界丢弃队列可以避免内存溢出的问题, 当队列满时忽略后续传入的消息. 这种队列在某些业务场景下可以有效的解决问题, 比如生产者推送的数据是用来代表某个业务对象发生变更的事件流. 每个事件都会触发一次重新统计计算的
> 操作, 这种情况下, 唯一重要的是业务对象发生变化的事实, 而哪些数据受到影响并不重要.  
> 
> 在每个消息都很重要的情况下, 可以选择有界阻塞队列. 但是阻塞的特性会导致系统无法进行异步操作, 一旦队列满, 将会导致生产者也会被阻塞, 直到消费者消费了一个数据. 也就是说最慢的消费者吞吐量=整个系统的总吞吐量. 

综上所述, 纯推模型中不受控制的语义会导致很多我们不希望出现的状况. 这也体现出了响应式宣言中强调的回压机制的重要性.
 
### 推拉混合

为了解决纯推模型的问题, 响应式流结合了拉模型制定了四个主要接口: Publisher, Subscriber, Subscription, Processor. 他们都定义在org.reactivestreams包中. 方法定义可看源码. 
这里记录Subscription中的方法. 它是响应式流规范中实现回压机制的关键. 
```java 
public interface Subscription {
    
    public void request(long n);

    public void cancel();
}
```

`cancel()`方法用于取消对流的订阅, 而`request()`方法则扩展了Publisher与Subscriber之间的交互能力. 通过调用这个方法消费者可以通知生产者应该推送多少数据. 加入这个机制后, Publisher只有在Subscriber要求时
才会发送元素中新的部分.
 

