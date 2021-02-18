---
prev: ./aqs
next: ./concurrent-package
sidebar: auto
---

# Lock接口

jdk1.5之后出现的Lock接口提供synchronized所不具备的三个特性: 他可以尝试非阻塞的获取锁; 能够被中断的获取锁; 超时获取锁.
它可以显示的获取和释放锁

Lock的实现依赖[AQS](./aqs.md)

## 重入锁

重入锁即支持重进入的锁, 表示该锁能够支持对一个资源的重复加锁.

先实现一个不支持重入的独占锁, 而后再其基础上改进为可重入锁.

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

synchronized隐式的支持[可冲入](./sync.md). 

Lock的子类ReentrantLock的lock方法同样实现了可重入. 同时ReentrantLock的构造函数还可以指定锁是否是公平锁. 公平的获取锁即等待时间最长的线程
优先获取锁. 反之是不公平的. 

### 可重入的实现

```java 
        /**
         *
         */
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



