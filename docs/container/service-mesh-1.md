---
prev: ./k8s-cluster
next: ./service-mesh-2
sidebar: auto
---

# 服务网格

## 什么是Service Mesh

在k8s的帮助下, 应用上云之后, 还面临着服务治理(如异常熔断, 服务降级, 链路追踪)的问题. **Service Mesh就是解决这类微服务发现和治理的一个概念**. 

随着云原生概念的流行, 容器加k8s的组合增强了应用的横向扩展能力, 我们可以轻松的编排出依赖关系复杂的应用程序. 快速的部署和调度服务. 
Service Mesh作为处理服务间通信的基础设施层, 为构建复杂的云原生应用传递可靠的网络请求. 

在现今的微服务架构中, 诸如Hystrix这样的SDK其实就是早期的Service Mesh, 但是他们都适用于特定的环境和特定的开发语言, 
不能作为平台级的支持. 所以Service Mesh诞生了, Service Mesh之于微服务架构就像TCP之于Web应用, 他有以下几个特点:

- 应用程序通信的中间层.
- 轻量级的网络代理.
- 应用程序无感知.
- 解耦应用程序的重试/超时, 监控, 追踪和服务发现.  

Service Mesh将底层的难以控制的网络通信统一管理, 上层的应用层协议只需要关心业务逻辑. 

Phil Calçado 在他的这篇博客 Pattern: Service Mesh 中详细解释了服务网格的来龙去脉：

1. 从最原始的主机之间直接使用网线相连
2. 网络层的出现
3. 集成到应用程序内部的控制流
4. 分解到应用程序外部的控制流
5. 应用程序的中集成服务发现和断路器
6. 出现了专门用于服务发现和断路器的软件包/库，如 Twitter 的 Finagle 和 Facebook 的 Proxygen，这时候还是集成在应用程序内部
7. 出现了专门用于服务发现和断路器的开源软件，如 Netflix OSS、Airbnb 的 synapse 和 nerve
8. 最后作为微服务的中间层服务网格出现

## 服务网格架构

![service-mesh-jg](http://image.ytg2097.com/service-mesh-jg.png)

服务网格中分为控制平面和数据平面. 

控制平面: 
- 不直接解析数据包. 
- 与控制平面中的代理通信, 下发策略和配置
- 负责网络行为的可视化
- 通常提供API或命令行工具可用于配置版本化管理, 便于持续集成和部署.

数据平面

- 通常是按照无状态目标设计的, 但实际上为了提高流量转发性能, 需要缓存一些数据, 因此无状态也是有争议的.
- 直接处理入站和出站数据包, 转发, 路由, 健康检查, 复杂均衡, 认证, 鉴权, 产生监控数据等.
- 对应用来说透明, 即可以做到无感知部署.


## Sidecar模式

sidecar模式通过给应用程序加上一个"边车"的方式扩展应用程序现有功能, 使两轮摩托变成了边三轮. 所有在业务服务中不需要实现的功能都可以交给sidecar,
业务服务只需要专注于实现业务逻辑就可以. 

sidecar一般有两种方式实现:

- **通过SDK的形式**. 在软件开发时引入依赖, 集成到业务服务中, 这种方式对代码有侵入, 并且会受到编程语言和开发人员水平的限制. 
不过这种方式可以与应用密切继承, 提高资源利用率并提高应用性能. 

- **agent模式**. 服务所有的通信都通过这个agent代理, 这个agent跟服务一起部署, 与服务有相同的生命周期. 并且对应用服务没有侵入, 
不受编程语言与开发人员水平的限制, 做到了控制和逻辑分开部署. 但是会增加应用延迟, 并且管理和部署的复杂度会增加. 

## Service Mesh与Sidecar

**Service Mesh作为应用程序的Sidecar运行, 他对应用程序来说是透明的, 所有服务间的流量都会通过sidecar, 然后由sidecar转发给应用程序**.

![service-mesh](http://image.ytg2097.com/service-mesh.png)

通过sidecar模式, 业务逻辑更加专一, 其他于业务服务关系不大的事情交由sidecar去处理. 比如流量控制, 服务发现, 服务熔断等.

## Service Mesh与k8s Service 

![service-mesh-vs-k8sservice](http://image.ytg2097.com/service-mesh-vs-k8sservice.png)

k8s集群的每个节点上都部署了一个kube-proxy组件, 这个组件与k8s的API Service通信, 获取集群的Service信息, 然后设置iptables/IPVS规则, 
直接将对某个Service的请求发送到对应的后端Pod上.

kube-proxy实现了流量在Service的负载均衡, 但是没法对流量做细粒度的控制, 例如灰度发布和蓝绿发布(按百分比划分流量到不同的应用版本). 因为k8s的蓝绿发布时针对Deployment的, 不支持Service.

Service Mesh把k8s看作是一个服务注册机构, 通过控制平面生成数据平面的配置, 数据平面的透明代理以sidecar容器的方式部署在每个应用服务的
pods中, 之所以说是透明代理, 是因为应用程序容器完全无感知代理的存在. 


同样是拦截流量, kube-proxy拦截的是进出k8s节点的流量, 而sidecar拦截的是进出pod的流量. 


## 何时使用Service Mesh

> 在应用一项新的技术之前, 首先要判断这项技术是否能够解决当下的痛点, 又会带来哪些技术债务

在nginx的文章中[https://www.nginx.com/blog/how-to-choose-a-service-mesh/](https://www.nginx.com/blog/how-to-choose-a-service-mesh/)主要有三点供参考

1. 已经完全应用k8s
2. 有大型的分布式应用程序
3. 频繁的部署成熟的CI/CD

简而言之: **只有当服务数量和服务间调用的复杂度上升到一定程度后, Service Mesh才会派上用场**.

