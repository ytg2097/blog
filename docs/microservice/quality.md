---
next: ./deploy
prev: ./ts
sidebar: auto
---

# 服务质量

服务质量保证主要分为鉴权, 可配置性, 可观测性, 服务基地四个部分. 

## 鉴权

采用API Gateway认证身份, 使用JWT传递身份和角色

JWT是自包含的, 要防止token泄露

 发布较短时间的JWT, 使用Oauth2.0规范
 
 ::: tip Oauth2.0
 - 授权服务器.  用于验证身份
 - token. token分为两个. 一个access token, 有效时间较短, 一个refresh token, 长效的可撤销的token, 用于刷新access token.
 - 资源服务器. 被客户端使用token访问的单个服务
 :::

## 可配置性

这里的可配置性指的是单个服务的运行环境的可配置性与相同服务多个实例的环境变量的可配置性, 服务的配置可分为推送模式和拉取模式两类

### 推送模式

- 命令行参数
- spring_application_json, 包含json的操作系统变量和jvm系统属性
- jvm系统属性
- 操作系统环境变量
- 当前目录中的配置文件

### 拉取模式

可采用[spring cloud config](https://cloud.spring.io/spring-cloud-config/reference/html/) 配合[spring cloud bus](https://spring.io/projects/spring-cloud-bus)可达到热更新的效果  

## 可观测性

::: tip 健康检查API 

可以公开的返回服务运行状况

可以使用的组件:[spring boot actuator](https://www.baeldung.com/spring-boot-actuators) , 可以可是服务实例与外部服务(如数据库)的连接

配置eureka 定期调用健康检查API, 来确定是否将流量路由到服务实例

docker add curl 定时调用检查API

:::
::: tip 日志聚合

Elasticsearch + logstash + kibana
:::  

::: tip 应用程序指标

服务运维指标, 如计数器(例: order事件技术), 并公开指标服务
::: 

::: tip 审核日志记录

记录用户操作, 实现方式可采用切面编程或[事件溯源](../ddd/event-source.md)
:::
::: tip 分布式追踪

 [spring cloud sleuth](https://spring.io/projects/spring-cloud-sleuth)追踪工具类库 + [OpenZipkin](https://zipkin.io/)追踪服务器 
 
 sleuth将追踪日志发送到追踪服务器, 服务器进行存储并供客户端查询
 :::
 ::: tip 异常追踪
 
 向异常跟踪服务报告异常, 异常跟踪服务可以对异常进行重复数据删除, 向开发人员发出警报, 并跟踪每个异常的解决方案
 :::
## 微服务基底

微服务基底是一个或一组框架, 处理服务通信与服务观察问题 [spring-coud-quick-starters](https://github.com/ytg2097/spring-coud-quick-starters)

## [服务网格](../container/service-mesh-1.md)




