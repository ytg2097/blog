---
sidebar: auto
next: ./factory
prev: ./
---

# 单例模式

常见的单例模式分为两种: 饿汉式(立即加载型)与懒汉式(延迟加载型). 饿汉式在类加载后会立刻初始化实例. 而懒汉式则是懒加载型, 只有初次使用时才会初始化实例. 

## 立即加载

```java
public class HungryManSingleton {
    
    // 类初始化立刻实例化实例
    private final static HungryManSingleton SINGLETON = new HungryManSingleton();

    // 私有构造方法, 不允许外部创建实例
    private HungryManSingleton(){}

    // 提供公共的实例获取方法
    public static HungryManSingleton getInstance(){

        return SINGLETON;
    }
}
```

## 懒加载

```java 

public class LazyLoadingSingleton {

    private static LazyLoadingSingleton INSTANCE ;

    private LazyLoadingSingleton(){}

    public static LazyLoadingSingleton getInstance(){

        // 当多个调用者同时访问实例时会出现线程安全问题
        if (INSTANCE == null){
            INSTANCE = new LazyLoadingSingleton();
        }
        return INSTANCE;
    }
}

```

## 同步方法

```java 

public class SynchronizedMethodSingleton {

    private static SynchronizedMethodSingleton INSTANCE ;

    private SynchronizedMethodSingleton(){}

    // 方法级别的粗粒度加锁会导致效率降低
    public static synchronized SynchronizedMethodSingleton getInstance(){

        if (INSTANCE == null){
            INSTANCE = new SynchronizedMethodSingleton();
        }
        return INSTANCE;
    }
}

```

## 双重校验

```java 

public class DoubleCheckSingleton {

    // 注意, 这里一定要加volatile防止指令重排
    private volatile static DoubleCheckSingleton INSTANCE ;

    private DoubleCheckSingleton(){}

    // 方法级别的粗粒度加锁会导致效率降低
    public static DoubleCheckSingleton getInstance(){

        if (INSTANCE == null){
            // 当INSTANCE为空时串行化的去实例化
            synchronized(DoubleCheckSingleton.class){
                // 当发现前一个线程已经执行过实例化后退出同步
                // 由于volatile修饰了INSTANCE, 
                if (INSTANCE == null){
                    INSTANCE = new DoubleCheckSingleton();
                }
            }
        }
        return INSTANCE;
    }
}
```

::: tip 为什么volatile修饰

INSTANCE = new DoubleCheckSingleton()并不是原子操作, JVM在执行这一语句时会分解为三步:
```
memory = allocate(); // 1. 分配一块内存
initInstance(memory); // 2. 初始化实例内存
instance = memory; // 3. 将内存指向实例
```

当出现指令重排时, 以上3步的顺序可能会重排序为1-3-2, 这时调用者已经认为对象已经实例化完毕可访问, 但对象实际上尚未初始化完毕, 当调用者访问对象时就会发生意想不到的错误. 
:::

## 静态内部类

```java
public class StaticInnerHolderSingleton {

    private StaticInnerHolderSingleton(){}
    
    private static class InstanceHolder{

        private static StaticInnerHolderSingleton INSTANCE = new StaticInnerHolderSingleton();
    }
    
    public static StaticInnerHolderSingleton getInstance(){
        
        // 由JVM保证并发的线程安全性
        return InstanceHolder.INSTANCE;
    }
}

```
::: tip JVM对类初始化的线程安全保证

JVM会保证一个类的类构造器&lt;clinit&gt;在多线程环境下会被加锁同步, 当多线程同时初始化时, 只会有一个线程去执行这个类的类构造器, 其他线程都会进入等待, 并且唤醒之后不会再执行&lt;clinit&gt;, 因为同一个类加载器下, 一个类
只会被初始化一次.
:::

## 枚举

```java 

public enum EnumSingleton{

    INSTANCE;
}
```


