---
prev: ./aqs
next: ./concurrent-package
sidebar: auto
---

# Lock接口

jdk1.5之后出现的Lock接口提供synchronized所不具备的三个特性: 他可以尝试非阻塞的获取锁; 能够被中断的获取锁; 超时获取锁.
它可以显示的获取和释放锁

Lock的实现依赖[AQS](./aqs.md),AQS通过一个volatile整形变量来维护同步状态, 基于这个volatile变量的内存语义, Lock接口实现了内存可见性.

## 重入锁

重入锁即支持重进入的锁, 表示该锁能够支持对一个资源的重复加锁.

先实现一个不支持重入的独占锁, 而后在其基础上改进为可重入锁.

```java 
public class Mutex implements Lock {

    private final Sync sync = new Sync();

    private static class Sync extends AbstractQueuedSynchronizer{

        @Override
        protected boolean tryAcquire(int arg) {
            
            if (compareAndSetState(0,1)){
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }

        @Override
        protected boolean tryRelease(int arg) {

            if (getState() == 0){
                throw new IllegalMonitorStateException();
            }
            setExclusiveOwnerThread(null);
            setState(0);
            return true;
        }

        /**
         * 当前是否处于独占状态
         * @return
         */
        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }
        
        ConditionObject newCondition(){
            return new ConditionObject();
        }        
    }

    @Override
    public void lock() {
        sync.acquire(1);
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {
        sync.acquireInterruptibly(1);
    }

    @Override
    public boolean tryLock() {
        return sync.tryAcquire(1);
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireNanos(1,unit.toNanos(time));
    }

    @Override
    public void unlock() {
        sync.release(1);
    }

    @Override
    public Condition newCondition() {
        return sync.newCondition();
    }
}

```
这把不支持重入的互斥锁中的AQS共有两个状态0, 1 . 0表示锁未被占用, 1表示锁已被某个线程占用, 后续线程尝试加锁时将进入同步队列阻塞. 
这把锁的AQS的tryAcquire()方法的实现没有考虑已经持有锁的线程尝试再次调用lock()方法时的情况, 当再次调用时已持有锁的线程也将会被阻塞.

[synchronized](./sync.md)隐式的支持重入. 

Lock接口的实现类ReentrantLock实现了可重入. 同时ReentrantLock的构造函数还可以指定锁是否是公平锁. 公平的获取锁即等待时间最长的线程
优先获取锁. 反之是不公平的. 

### 可重入的实现

---
```java 
        
        final boolean nonfairTryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) {
                if (compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            // 当AQS的同步状态已被持有时, ReentrantLock加入了同步状态的持有者判断
            else if (current == getExclusiveOwnerThread()) {
                int nextc = c + acquires;
                if (nextc < 0) // overflow
                    throw new Error("Maximum lock count exceeded");
                // 若是已持有锁的线程尝试重复加锁会将AQS的state增加
                setState(nextc);
                return true;
            }
            return false;
        }

        protected final boolean tryRelease(int releases) {
            int c = getState() - releases;
            if (Thread.currentThread() != getExclusiveOwnerThread())
                throw new IllegalMonitorStateException();
            boolean free = false;
            // ReentrantLock的最终释放锁的条件是state == 0
            if (c == 0) {
                free = true;
                setExclusiveOwnerThread(null);
            }
            setState(c);
            return free;
        }   
```

### 公平与非公平的实现

---
#### 非公平锁的实现
```java 

        final boolean nonfairTryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) {
                // 在非公平锁的实现中, 只要能够CAS修改AQS的state成功即可获取到锁
                if (compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            ...
        }    
```

#### 公平锁的实现

```java 

        protected final boolean tryAcquire(int acquires) {
            final Thread current = Thread.currentThread();
            int c = getState();
            if (c == 0) {
                // 多出了一步hasQueuedPredecessors()
                if (!hasQueuedPredecessors() && compareAndSetState(0, acquires)) {
                    setExclusiveOwnerThread(current);
                    return true;
                }
            }
            ...
        }    
```

在公平锁的实现中多出了一步判断当前节点是否有前驱节点, 如果有表示已经有线程在更早之前就已经请求锁了.

ReentrantLock默认实现是非公平锁, 原因是非公平锁不会引起大量的线程切换. 但需要注意的是非公平锁可能会造成线程饥饿. 
## 读写锁

读写锁在同一时刻允许多个读线程同时访问, 但是在写线程访问时, 所有的读线程和其他写线程将被阻塞. 

java并发包中提供读写锁的实现是ReentrantReadWriteLock. 它提供公平性选择, 支持重入, 支持锁降级. 遵循获取写锁, 获取读锁再释放写锁的次序, 写锁能够降级为读锁.

ReentrantReadWriteLock实现了ReadWriteLock接口, 同时还对外提供了一些便于检测内部状态的方法.

| 方法 | 描述|
| --- | ---|
| int getReadLockCount()| 返回当前读锁被获取的次数. 这个次数不等于获取读锁的线程数. 例如一个线程获取了读锁多次(重进入), 这个方法将返回n而不是1|
| int getReadHoldCount()| 返回当前线程获取读锁的次数. jdk1.6之后使用ThreadLocal保存当前线程获取的次数|
| boolean isWriteLocked()| 判断写锁是否正在被占用|
|int getWriteHoldCount()| 返回当前写锁被获取次数|

### 设计

---
ReentrantReadWriteLock内部的AQS采用**按位切割使用**的方式在一个整形变量上维护了多种状态. 读写锁将这个变量切分成两部分, 高16位表示读, 低16位表示写. 

读写锁通过对这个变量做位运算确定读写状态. 写状态 = state & 0x0000FFFF. 读状态 = state >>> 16(无符号补0右移16位). 当写状态增加1时, 等于state + 1. 当读状态增加1时, 等于 state + (1 << 16), 也就是state + 0x00010000.

```java 

    public class ReentrantReadWriteLock
            implements ReadWriteLock, java.io.Serializable {
    
        ...
        private final ReadLock readLock;
        private final WriteLock writeLock;
        // readLock和writeLock公布想Sync
        final Sync sync
        public ReentrantReadWriteLock() {
            this(false);
        }
        
        public ReentrantReadWriteLock(boolean fair) {
            sync = fair ? new FairSync() : new NonfairSync();
            readerLock = new ReadLock(this);
            writerLock = new WriteLock(this);
        };
    }        
```

### 写锁的获取与释放

---
读写锁的写锁是一个支持重入的排他锁. 若当前线程已经获取了写锁, 则增加写状态. 若获取写锁时, 读锁已被获取, 或写锁已被其他线程获取, 则线程进入等待.

```java 

        protected final boolean tryAcquire(int acquires) {
            /*
             * Walkthrough:
             * 1. If read count nonzero or write count nonzero
             *    and owner is a different thread, fail.
             * 2. If count would saturate, fail. (This can only
             *    happen if count is already nonzero.)
             * 3. Otherwise, this thread is eligible for lock if
             *    it is either a reentrant acquire or
             *    queue policy allows it. If so, update state
             *    and set owner.
             */
            Thread current = Thread.currentThread();
            int c = getState();
            int w = exclusiveCount(c);
            if (c != 0) {
                // (Note: if c != 0 and w == 0 then shared count != 0)
                // 对应第一种情况
                if (w == 0 || current != getExclusiveOwnerThread())
                    return false;
                // 对应第二种情况    
                if (w + exclusiveCount(acquires) > MAX_COUNT)
                    throw new Error("Maximum lock count exceeded");
                // Reentrant acquire
                setState(c + acquires);
                return true;
            }
            // 对应第三种情况
            if (writerShouldBlock() ||
                !compareAndSetState(c, c + acquires))
                return false;
            setExclusiveOwnerThread(current);
            return true;
        }
```

写锁的释放与ReentrantLock类似, 每次释放减少写状态.

### 读锁的获取与释放

---
读锁是一个支持重进入的共享锁.


```java 

    // 这部分代码参考Java并发编程的艺术, 忽略了与getReadHoldCount()相关的代码
    protected final int tryAcquireShared(int unused){
        for(;;){
            int c = getState();
            int nextc = c = (1 << 16);
            if (nextc < c){
                throw new Error("Maximum lock count exceeded");
            }
            if(exclusiveCount(c) != 0 && owner != Thread.currentThread()){
                return -1;
            } 
            if(compareAndSetState(c, nextc)){
                return 1;
            }
        }
    }
```
## 锁降级

锁降级是指当前线程持有写锁, 又获取读锁, 再释放写锁的过程.

**示例**

```java 

    private volatile boolean update;
    public void processData(){
        
        readLock.lock();
        if(!update){
            readLock.unLock();
            // 开始锁降级
            writeLock.lock();
            try{
                if(!update){
                    update = true;
                }
                readLock.lock();
            }finally{
                writeLock.unLock();
            }
            // 锁降级完成.
        }
        try{
            // ...使用数据
        }finally{
            readLock.unLock();
        }
    }
```

### 为何必须要获取到读锁

---
只有在释放写锁之前同时拿到读锁, 才可以起到阻塞其他见缝插针的写线程拿到写锁并写入数据, 导致当前线程无法感知其他线程的数据更新问题

### 为何不支持锁升级

---
写锁只有在读锁未被持有的情况下才能获取

## LockSupport

它提供了线程的阻塞与唤醒功能, 其中park方法的blocker对象可以为开发人员提供详细的堆栈信息.

## Condition

Condition提供类似Object的监视方法

Condition是AQS的内部类, 因此每个Condition都拥有AQS的引用

ConditionObject内部维护了一个AQS的同步队列, 当调用了awit()时, 相当于同步队列的首节点移动到了等待队列中.

当调用signal()时会将等待队列中等待时间最长的节点移动到同步队列中. 当这个节点从同步队列中获取到锁时, 从awit()返回.
 
