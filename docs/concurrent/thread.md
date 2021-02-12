---
sidebar: auto
---

# 线程与线程池

## 线程的优先级

不同操作系统的线程优先级规划存在差异, 甚至会忽略线程优先级设定.
```
    Thread thread = new Thread(() -> {...});
    // 默认优先级为5
    thread.setPriority(1到10)
```

## 线程状态

- new 线程创建尚未运行, 处于就绪状态
- run 运行状态. 
> java将操作系统中的运行和就绪统称为运行状态
- blocked 阻塞状态
- waiting 等待状态
- waiting_time 超时等待状态
- terminated 结束

## 中断

thread.interrupt()方法会中断目标线程, 但中断不等于使目标线程立刻结束, 而是设置一个标记,
当在线程处于阻塞状态时, 如果检查到线程的阻塞标记为true时, 将会抛出InterruptedException, 线程在抛出InterruptedException之前会先将中断标志清除.

thread.isInterrupted()方法目标线程的中断标记

Thread.interrupted()可以返回当前线程的中断标记, 并对当前线程的中断标志复位. 

## join

thread.join()方法会使当前线程等待目标线程终止才会从join方法返回

## Daemon线程

在线程运行之前, setDaemon将线程设置为守护线程, 守护线程在虚拟机退出时会自动退出, 守护线程的finally块代码不一定执行.

# 线程

## 线程池大小

线程池数量过大会带来大量不必要的线程上下文切换开销. 
线程池的理想大小取决于任务的类型以及所部署系统的特性. 对于计算密集型任务, 线程池大小为CPU +1 利用率为最佳.对于包含IO操作或其他阻塞操作的任务, 线程池大小 = 
cpu数量 * (线程等待时间(非cpu运行时间, 如IO)与线程cpu运行时间之比 + 1), 也就是线程等待时间所占的比例越高, 所需要的线程数量越多. 线程CPU运行时间所占比例越高, 所需要的线程数量越少.

## 线程池的任务队列

当线程池被所有线程都在被使用时, 新提交的任务将添加到任务队列中等待稍后执行
- 有界队列. 
- 无界队列. newFixedThreadPool和newSingleThreadPool默认使用一个无界队列LinkedBlockingQueue
- 同步移交. SynchronousQueue不是一个真正的队列. 而是一种在线程之间一脚的机制, 任务将直接提交给线程, 只有线程池时无界的或者有拒绝策略时, 才有实际价值.

## 线程池的饱和策略

当线程池的任务队列满时, 再次添加新的任务会触发线程池的饱和策略. 
- AbortPolicy. 默认的饱和策略, 会抛出一个RejectedException.
- CallerRunsPolicy. 不会抛弃任务, 也不会抛出异常, 而是将任务回退给调用者, 谁调用了execute, 任务就退还给谁来执行.
- DiscardPolicy. 当新提交的任务无法保存到队列中时, 会悄悄抛弃掉该任务
- DiscardOldestPolicy. 抛弃下一个将被执行的任务, 然后重新提交新任务, 最好不要和优先级队列一起使用

当没有预定义的饱和策略时, 可以使用信号量来控制任务的提交速率, 信号量大小为线程池大小及可排队任务的数量


