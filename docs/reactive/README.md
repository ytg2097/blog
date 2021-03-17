---
next: ./rxjava
---

# 响应式编程

响应式编程与[反应器模式](../reactor)的目标都是提高系统的吞吐量. 但不同的是, 响应式编程是一种编程的方式方法, 或者说风格.而反应器模式则是一种网络编程模式. 二者不能混为一谈. 

在响应式系统中, 我们需要系统具备即时响应性, 弹性, 回弹性以及消息驱动. 这样的系统称之为响应式系统. 响应式系统更加的灵活可伸缩. 

使系统成为响应式系统或者说具备即时响应性, 需要具备两个特质: 

- 弹性. 弹性描述了系统在不同负载下保持即时响应的能力.
- 回弹性. 回弹性指系统在发生故障时也能够保证即时响应. 如熔断机制. 

弹性与回弹性之间是紧密关联的, 只有两者同时启用才能实现真正的即时响应.


## 消息驱动通信

在以往的网络编程模型中, 应用服务之间的通信往往是通过http通信来完成, 但在java语言中http通信是同步阻塞的. 一个服务请求另一个服务的过程中, 会耗费大量的时间在IO阻塞上不能处理其他请求. 为了实现异步非阻塞的交互,
或者说实现即时响应性, 我们可以使用消息驱动的方式: **每个服务在消息到达时会对其做出相应, 否则处于休眠状态;  同样的, 服务发送消息的方式也应该是非阻塞的**. 由此可以得出下图

![reactive](../.vuepress/images/reactive-traits-zh-cn.svg)


## 实现响应性的方法

响应式宣言中提出**大型系统由多个较小型的系统构成, 因此整体效用取决于他们的构成部分的反应式属性**. 由此可以看出一个系统的响应性分为两部: 1. 子系统之间的响应性; 2. 子系统的构成部分的响应性. 
在实现子系统之间的响应性时, 我们可以采用Spring Cloud框架, 它所提供的熔断, 负载均衡等机制实现了子系统也就是服务间的响应性. 而子系统的构成部分的响应性实现Spring也有提供, 如WebFux. spring-data-redis-reactive等.

--- 
本篇博客用于记录学习响应式编程中的知识点. 其中主要来自于Spring响应式编程一书.

- [RxJava](./rxjava.md)
- [响应式流](./reactive-streams.md)

