---
prev: ./optimization
sidebar: none
---

# JVM配置

## 参数
JVM配置参数的第一位都是**X**, 表示对JVM的配置


- -Xss: 设置线程的最大栈空间, 决定了栈的深度, 默认都是1024KB

    ```
       -Xss256k 
    ```

- -Xms: 设置堆空间的起始内存大小, 默认大小是物理内存/64

    ```
        -Xms10m
    ```

- -Xmx: 设置堆空间的最大内存大小, 默认大小是物理内存/4

    ```
        -Xmx10m
    ```
    
    ::: tip Tip
     -Xms与-Xmx最好设置为相同的值, 避免扩容操作
    ::: 
    
- -XX:+PrintGCDetails: 控制台打印GC日志

   ```
       -XX:+PrintGCDetails
   ```
   
- -XX:NewRatio=2: 修改新生代与老年代在堆空间的占比, 后面的数字表示老年代是新生代的几倍
   ```
       -XX:NewRatio=2 // 新生代占1, 老年代占2, 新生代占1/3
       -XX:NewRatio=4 // 新生代占1, 老年代占5, 新生代占1/5
   ```
   
- -XX:SurvivorRatio=8: 修改新生代中Eden与From和To的比例
   ```
       -XX:SurvivorRatio=8 // Eden占1, From占2, To占1/3
   ```   

- -Xmn: 设置新生代内存大小, 当与-XX:NewRatio配置冲突时, 以-Xmn为准. 
   ```
       -Xmn200m //设置新生代大小为200m
   ```    
   
- -XX:**-** UseAdaptiveSizePolicy: 关闭自适应内存分配策略, 默认是打开的, **-** 号改为 **+** 号为开启
   ```
       -XX:-UseAdaptiveSizePolicy // 关闭自适应内存分配策略
       -XX:+UseAdaptiveSizePolicy // 开启自适应内存分配策略
   ```   
   
- -XX:MaxTenuringThreshold: 设置GC多少次后新生代对象晋升到老年代, 默认15次
   ```
       -XX:MaxTenuringThreshold=20  //GC20次晋升到老年代
   ```    
   
- -XX:HandlePromotionFailure: 设置空间分配担保, **JDK7之后不再使用**
   ```
       -XX:HandlePromotionFailure=true  //空间分配担保
   ```
   
- -XX:+UseTLAB: 开启关闭TLAB, 默认是开启的
   ```
       -XX:+UseTLAB  //开启TLAB
       -XX:-UseTLAB  //关闭TLAB
   ```  

- -XX:TLABWasteTargetPercent: 修改TLAB占Eden空间的百分比, 默认1%
   ```
       -XX:TLABWasteTargetPercent=5
   ```     
   
- -XX:+DoEscapeAnalysis: jdk7后Server模式下默认启动逃逸分析
   ```
       -XX:TLABWasteTargetPercent=5
   ```     
   
- -XX:+PrintFlagsInitial: 查看所有JVM参数的默认初始值
   ```
       -XX:+PrintFlagsInitial
   ```   
- -XX:+PrintFlagsFinal: 查看所有参数的最终值(可能是默认值, 也可能修改过)
   ```
       -XX:+PrintFlagsFinal
   ```               
   

## 命令

- jps: 查看java进程

- jstat:

    -   -gc: 查看GC信息
        ``` 
            jstat -gc java进程pid 
        ```

- jinfo 

    - -flag: 查看运行中的jvm进程的参数配置
        ``` 
            jinfo -flag UseTLAB java进程pid
        ```
