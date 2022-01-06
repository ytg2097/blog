---
sidebar: auto
prev: ./builder
next: ./bridge
---

# 适配器模式

适配器模式主要用于将差异化的接口或属性统一输出为指定的格式. 

![application-service](http://image.ytg2097.com/DDD-2.png)

在六边形架构中, 适配器的角色用于将外部客户的不同协议的请求处理器后统一调用领域服务, 同时又将领域服务对基础设施的操作请求转换为具体的技术设施所要求的协议格式. 

## 示例



