---
sidebar: auto
---

# 反应式编程

本篇笔记为Doug Lea的Scalable IO in Java文章的读后笔记

![socket](../.vuepress/images/socket.png)

传统的网络服务设计模式会为每个连接的处理新开一个线程, 这个线程负责读取请求数据, 解码数据, 数据, 编码回复数据, 发送回复. 所有动作是串行化的. 当出现大量连接时会导致创建大量线程. 线程上下文切换开销大, 消耗资源降低效率. 
且socket连接后, 如果客户端不再发送数据, 会搁置线程.

这种模式在现在的大规模网络流量应用中已经不能满足需求. 

由此出现了事件驱动的分发模式. 他具备如下机制: 
> 1. 将一个完成处理过程分解为一个个小任务
> 2. 每个任务执行相关动作且不阻塞
> 3. 在任务执行状态被触发时才会执行, 如有数据时才触发读操作. 

java的nio包实现了分发模式, 它具备非阻塞的读写, 通过感知IO事件分发任务执行. 它不需要为每一个客户端都建立一个线程, 减少了上下文切换. 

为了更好的实现低延迟, 高吞吐量, 可调记得服务质量等特点, 又出现了Reactor模式. 

## Reactor模式特点

>1. Reactor模式会通过分配适当的handler来响应IO事件
>2. 每个Handler执行非阻塞的操作
>3. 通过将Handler绑定到事件来进行管理

::: tip NIO的Reactor实现

每一个selector对应一个reactor线程

通过将不同的处理程序绑定到不同的IO事件达到反应式的目地(IO事件驱动)
:::

## 单线程的Reactor模式

![singleThread-Reactor](../.vuepress/images/singleThread-Reactor.png)

```java

class Reactor implements Runnable { 
    final Selector selector;
    final ServerSocketChannel serverSocket;
    Reactor(int port) throws IOException {
        selector = Selector.open();
        serverSocket = ServerSocketChannel.open();
        serverSocket.socket().bind(new InetSocketAddress(port));
        serverSocket.configureBlocking(false);
        // 将ServerSocketChannel注册到Selecor, 关心accept事件
        SelectionKey sk = serverSocket.register(selector, SelectionKey.OP_ACCEPT); 
        // 将Acceptor一并注册到SocketChannel上
        sk.attach(new Acceptor()); 
    }
    
    public void run() { 
        try {
            while (!Thread.interrupted()) {
                // 阻塞等待事件发生
                selector.select();
                Set selected = selector.selectedKeys();
                Iterator it = selected.iterator();
                while (it.hasNext())
                    // 取出每个监听到的事件并分发出去
                    dispatch((SelectionKey)(it.next()); 
                selected.clear();
            }
        } catch (IOException ex) { /* ... */ }
    }
    
    void dispatch(SelectionKey k) {
        // 取出Acceptor
        Runnable r = (Runnable)(k.attachment()); 
        if (r != null)
            r.run();
    }
    
    class Acceptor implements Runnable { 
        public void run() {
            try {
                SocketChannel c = serverSocket.accept();
                if (c != null)
                // 处理新连接
                new Handler(selector, c);
            }
            catch(IOException ex) { /* ... */ }
        }
    }
}

final class Handler implements Runnable {
    final SocketChannel socket;
    final SelectionKey sk;
    ByteBuffer input = ByteBuffer.allocate(MAXIN);
    ByteBuffer output = ByteBuffer.allocate(MAXOUT);
    static final int READING = 0, SENDING = 1;
    int state = READING;
    
    Handler(Selector sel, SocketChannel c) throws IOException {
        socket = c;
        c.configureBlocking(false);
        // 将新的socket也注册到selector上, 关心读事件
        sk = socket.register(sel, 0);
        // 将自身也注册到新的socket上, 当再有事件时就不走Acceptor了  而是走Handler的run()
        sk.attach(this); 
        sk.interestOps(SelectionKey.OP_READ);
        sel.wakeup();
    }
    boolean inputIsComplete() { /* ... */ }
    boolean outputIsComplete() { /* ... */ }
    void process() { /* ... */ }
    
    public void run() {
        try {
            if (state == READING) read();
            else if (state == SENDING) send();
        } catch (IOException ex) { /* ... */ }
    }
    
    void read() throws IOException {
        socket.read(input);
        if (inputIsComplete()) {
            process();
            state = SENDING;
            // Normally also do first write now
            sk.interestOps(SelectionKey.OP_WRITE);
        }
    }
    void send() throws IOException {
        socket.write(output);
        if (outputIsComplete()) sk.cancel(); 
    }
}
```
## Reactor的多线程模式

![multiThread-reactor](../.vuepress/images/mutiThread-reactor.png)
将非IO操作分离来提升Reactor线程的处理性能, 比将非IO操作设计成事件驱动的方式更简单, 但是很难与IO重叠处理, 最好能在第一时间将所有的输入读入缓冲区. 可以通过线程池对线程进行调优与控制.

```java 
class Handler implements Runnable {
        // uses util.concurrent thread pool
        // worker线程池
        static PooledExecutor pool = new PooledExecutor(...);
        static final int PROCESSING = 3;

        // ...
        synchronized void read() { // ...
            socket.read(input);
            if (inputIsComplete()) {
                state = PROCESSING;
                // 将数据处理工作提交到线程池
                pool.execute(new Processer());
            }
        }

        synchronized void processAndHandOff() {
            process();
            state = SENDING; 
            sk.interest(SelectionKey.OP_WRITE);
        }

        class Processer implements Runnable {
            public void run() {
                processAndHandOff();
            }
        }
    }
```

多线程版本增加了worker线程, 专门处理非IO操作. 
## 多Reactor模式

```java 

    Selector[] selectors; // Selector集合，每一个Selector 对应一个subReactor线程
    //mainReactor线程
    class Acceptor { // ...
        public synchronized void run() { 
            //...
            Socket connection = serverSocket.accept(); 
            if (connection != null)
              new Handler(selectors[next], connection); 
            if (++next == selectors.length)
                next = 0;
        }
    }
```
![multiReactor](../.vuepress/images/multiReactor.png)


在多Reactor模式中Reactor分为了MainReactor与SubReactor两类. 

MainReactor负责接收连接. 
> NIO的MainReactor实现是acceptor
>
> Netty的MainReactor实现是EventLoopGroup(parent). accept方法监听连接事件, 监听到连接后将连接包装为NIOSocketChannel, 然后在ServerBootstrapAcceptor的channelRead方法中将channel注册到workEventLoopGroup上

维护SubReactor用于处理IO事件
> Netty的实现是EventLoop(work), work监听OP_READ事件


## Reactor中的角色

::: tip Handle(句柄或描述符)
它本质上表示的是一种资源, 由操作系统提供. 这个资源用于标示一个个的事件, 比如文件描述符, 针对网络编程中的Socket描述符, NIO的Channel.

Handle本身是事件产生的发源地. 事件既可以来自于外部, 也可以来自于内部. 外部可能是客户端连接, 发送数据等. 内部可以是操作系统产生的定时器事件等.
:::

::: tip Synchronous Event Demultiplexer 同步事件分离器
本质上是一个系统调用, 用于等待事件发生(事件可能一个, 也可能多个). 调用方在调用它时会阻塞, 知道同步事件分离器上有事件产生为止.

对于Linux来说, 同步事件分离器指IO多路复用的机制, 比如select, poll, epoll. 在NIO中是Selector. 在Netty中是EventLoop
:::

::: tip EventHandler
本身由多个回调方法构成, 这些方法构成了与应用相关的对于某个事件的反馈机制. 

Netty做了升级, 每个事件都提供了钩子方法
:::


::: tip Concreate Event Handler
EventHandler的实现者
:::

::: tip Initlation Dispatcher 初始分发器
它对应reactor角色, 本身定义了一些规范, 这些规范用于控制事件的调度方式, 同时提供了应用对于事件处理器的创建删除等方法. 

通过同步事件分离器等待事件的发生, 一旦事件发生, 就会分离出每个事件, 然后调用事件处理器, 即响应的钩子方法处理事件. 
:::


**先有Reactor后有NIO, NIO可以理解为是Reactor的不完全实现, Netty是完全实现**. 
