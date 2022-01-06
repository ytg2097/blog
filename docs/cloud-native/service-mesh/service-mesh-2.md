---
prev: ./service-mesh-1
sidebar: auto
---

#　Istio

Istio是Service Mesh的实现. 它是一个提供微服务连接的, 安全的, 流量控制的和可观察性的开放平台. 

Istio作为Service Mesh的实现, 架构同样分为两个部分: 数据平面和控制平面.

数据平面有一组sidecar的代理(Enovy)组成. 这些代理调节和控制微服务之间的所有网络通信, 并且与控制平面的Mixer通信, 接受调度策略.

控制平面通过管理和配置Envoy来管理流量. 此外, 控制平面配置Mixers来实施路由策略并收集检测到的监控数据.

## 架构 

![image-20210624094633456](http://image.ytg2097.com/img/image-20210624094633456.png)

从Istio的架构图中可以看到Istio主要有Envoy, Pilot, Mixer, Citadel四个组件. 其中Envoy作为Sidercar注入到Pod中作为代理拦截进出服务的流量并对流量加以控制, 上图中proxy部分就是Envoy.  Pilot在控制平面中提供服务发现和流量管理(A/B测试, 金丝雀部署等), 异常控制(超时, 熔断, 重试)的功能; Mixer是独立于平台的组件, 负责在整个Service Mesh中执行访问控制和使用策略; Citadel内置身份和凭证管理, 提供服务和用户的身份验证.

## 安装Istio



## Istio的Sidercar注入

**Istio会在每个创建的Pod中都自动注入一个sidecar: Envoy**

Envoy是一个开源的用c ++ 开发的高性能代理, 管理Service Mesh中所有服务的出入站流量, 功能类似nginx的七层代理. 

> 七层代理来源于OSI七层模型. 七层指的是应用层. nginx的七层代理根据http协议中的某些属性来做hash. 七层代理之外还有四层代理, 四层代理根据用户ip + port来做hash

Istio使用了Envoy中的许多内置功能, 如动态服务发现, 负载均衡, 断路器, 健康检查等等. 











