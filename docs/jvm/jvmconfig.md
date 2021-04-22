---
prev: ./optimization
sidebar: none
---

# JVM配置

## 参数
JVM配置参数的第一位都是**X**, 表示对JVM的配置

- 栈配置

    -Xss: 设置线程的最大栈空间, 决定了栈的深度, 默认都是1024KB
    ```
       -Xss256k 
    ```

- 堆配置

    -Xms: 设置堆空间的起始内存大小, 默认大小是物理内存/64
    ```
        -Xms10m
    ```
    -Xmx: 设置堆空间的最大内存大小, 默认大小是物理内存/4
    ```
        -Xmx10m
    ```
    
    ::: tip Tip
     -Xms与-Xmx最好设置为相同的值, 避免扩容操作
    ::: 
    
   -XX:PrintGCDetails: 控制台打印GC日志
   ```
       -XX:PrintGCDetails:
   ```

## 命令
