---
prev: ./
sidebar: auto
---

# K8s部署Redis集群

## 调研

### Redis集群方案

#### 主从复制

![replication](http://image.ytg2097.com/img/image-20210823152755829.png)

主从复制模式的redis与mysql类似. master数据库的所有写命令都会保存到文件中(一般是rdb文件), slave数据库启动后会向master请求这个文件并回放文件中的命令. 在之后master每执行一个写命令都会同步给slave.

主从复制模式的集群因为可以创建多个slave实例, 搭配负载均衡策略可以有效的分摊读操作的压力.

**缺点**

- 故障恢复难: master节点故障时, 需要手动将一个slave节点升级为master节点, 并且让其他slave节点去复制新的master节点. 这个过程需要人工干预, 比较繁琐.

- 复制中断问题: 复制中断后, slave会发起psync(部分重同步), 如果此时同步失败就会进行全量重同步. 全量重同步可能会造成主库的卡顿. 内存溢出. IO. CPU. 带宽异常, 导致阻塞客户端请求

  > 重同步用于将slave的状态更新到master当前所处的状态.

- master的写和存储能力受单机限制

#### 哨兵模式

哨兵模式基于主从复制, 引入了哨兵监控和自动故障处理.

![sentinel-cluster](http://image.ytg2097.com/img/image-20210823154202526.png)

哨兵模式的集群分为两个部分: redis sentinel集群和redis replication集群. 其中sentinel集群有若干个哨兵节点组成, 哨兵节点的功能主要是监控master和slave是否正常运行; 监控到master故障时, 自动将slave转换为master; 哨兵互相监控.

哨兵模式继承了主从复制模式的优点, 且解决了主从模式的master切换问题. 但是难易在线扩容.

#### redis cluster

redis-cluster是redis3.0后推出的集群方案. 集群是去中心化的. 采用分区的多主多从的设计,  每一个分区都由一个master和多个slave组成. 分区之间相互平行. 他解决了主从复制模式不能在线扩容, master受限于单机限制的问题.

![redis-cluster](http://image.ytg2097.com/img/redis-cluster-setup.c1d7206d.png)

cluster模式没有统一入口, 客户端与任意redis节点直连, 不需要代理. 集群内所有节点相互通信.  在cluster模式中, 每个节点上都有一个插槽, 这个插槽的取值范围是16383, 每当客户端存取一个key时, redis根据CRC算法对key算出一个值然后拿这个值对16383取余, 这样每个key都会在插槽中对应一个在0到16383之间的hash槽. 然后再找到插槽所对应的节点. 如果key所在的节点不是当前节点的话, 客户端请求的当前节点会通过重定向命令引导客户端去访问包含key的节点. 这就解决了主从复制模式中master受限于单机限制的问题. 因为在cluster模式中, 每一个master节点只维护一部分槽, 以及槽所映射的键值对. 而且hash槽的方式方便与扩缩容节点, 只需要移动槽和数据到对应节点就可以.

同时为了保证HA, cluster模式也是有主从复制的, 一个master对应多个slave, master挂掉的时候会自动升级一个slave替补.

**缺点**

- 同样是因为插槽的设计, 集群的数据是分散存储的. 如果出现问题, 可能会需要回滚整个集群.
- 多key操作受限比如事务. 因为rediscluster要求key在同一个slot中才能执行. 要解决这个限制需要使用rediscluster提供的hashtag去映射一组key到slot, 这也就需要我们的客户端去适配这种协议
- reduscluster只支持一个数据库 : 0

#### 代理分区

代理分区模式的代表是codis, codis是豌豆荚用go语言自研的是一个分布式redis集群. 他在redis服务器与客户端之间增加了一个代理层, 客户端的命令发送到代理层, 然后代理层去做请求的分发. 他不需要客户端去适配协议, 客户端可以像使用单机redis一样使用codis

codis与rediscluster类似, 也是通过hash槽来进行分片, 所以codis同样不支持多key操作.  codis不是去中心化的, codis使用zookeeper来维护hash槽位与实例之间的关系.

![codis](http://image.ytg2097.com/img/image-20210824091044018.png)

参考文档: https://gitee.com/mirrors/Codis?utm_source=alading&utm_campaign=repo#/mirrors/Codis/blob/release3.2/doc/tutorial_zh.md

### 取舍

最后决定采用redis官方的集群方案.

首先我们需要部署到k8s, 所以我们一定会有扩缩容的需求, 所以首先pass掉主从复制和哨兵模式. 然后, codis比较与redis-cluster多了对其他中间件的依赖, 对运维的要求更高一点. 相比之下redis-cluster更简单易用一些.

## 实施

### 什么是Operator

k8s使用statefulset来处理有状态的容器, 结合headless和PV/PVC实现了对pod的拓扑状态和存储状态的维护. 但是statefulset只能提供受限的管理, 我们还是需要编写脚本判断编号来区别节点的关系: master or slave. 以及他们之间的拓扑关系. 如果应用无法通过上述方式进行状态管理, 那就代表statefukset已经无法解决应用的部署问题了.

k8s中的声明式模型中要求我们向k8s提交一个API对象的描述, 然后k8s的controller会通过无限循WATCH这些API对象的变化, 确保API对象的状态与声明的状态保持一致. **operator就是k8s的controller, 只不过是针对特定的CRD(CustomResourceDifinition)实现的**.  CRD用于描述operator要控制的应用, 比如redis-cluster. CRD的作用就是为了让k8s能够认识我们的应用. 然后我们再去实现一个自定义controller去WATCH用户提交的CRD实例. 这样当用户告诉k8s: "我想要一个这样的应用". 之后针对这个应用的operator就会通过WATCH协调应用的状态达到CRD描述的状态.

![operator](http://image.ytg2097.com/img/15b4c3dc71f7221589fd3d66202a727b.png)

**operator是一个针对于特殊应用的controller**, 它提供了一种在k8s API上构建应用并在k8s上部署应用的方法, 它允许开发者扩展k8s API增加新功能, 像管理k8s原生组件一样管理自定义资源. 如果想运行一个redis哨兵模式的主从集群, 那么只需要提交一个声明就可以了, 而不需要去关心这些分布式应用需要的相关领域的知识, operator本身就可以做到创建应用, 监控应用状态, 扩缩容, 升级, 故障恢复, 以及资源清理等.

### Redis Operator部署

#### 安装helm

helm是k8s的包管理工具, 安装步骤见官方文档https://helm.sh/zh/docs/intro/install/

#### 安装redis-cluster集群

```bash
[root@node1 ~]# helm repo add ot-helm https://ot-container-kit.github.io/helm-charts/
[root@node1 ~]# helm upgrade redis-cluster ot-helm/redis-cluster   --set redisCluster.clusterSize=3,redisCluster.redisSecret.secretName=redis-secret,redisCluster.redisSecret.secretKey=password --install
Release "redis-cluster" has been upgraded. Happy Helming!
NAME: redis-cluster
LAST DEPLOYED: Tue Aug 24 16:50:50 2021
NAMESPACE: default
STATUS: deployed
REVISION: 2
TEST SUITE: None
```

这里指定了集群大小为3, redis密码为password.

查看redis集群状态

```bash
[root@node1 ~]# kubectl get pods
NAME                                      READY   STATUS    RESTARTS   AGE
mysql-0                                   2/2     Running   0          6h22m
mysql-1                                   2/2     Running   4          4d3h
mysql-2                                   2/2     Running   0          6h22m
nfs-client-provisioner-864c877bf6-bszsz   1/1     Running   3          4d5h
redis-cluster-follower-0                  2/2     Running   0          13m
redis-cluster-follower-1                  2/2     Running   0          14m
redis-cluster-follower-2                  2/2     Running   0          16m
redis-cluster-leader-0                    2/2     Running   0          7m16s
redis-cluster-leader-1                    2/2     Running   0          14m
redis-cluster-leader-2                    2/2     Running   0          16m
redis-operator-67ff7665db-fm89s           1/1     Running   0          30m
[root@node1 ~]# kubectl exec -it redis-cluster-leader-0  -- redis-cli -a password cluster nodes
Defaulted container "redis-cluster-leader" out of: redis-cluster-leader, redis-exporter
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
6e418e911aee8e80c9c6864591694d54fb10ccc0 10.100.104.30:6379@16379 slave 7cfa62aaf91e0c5a528b59aad46054c7f4d057ca 0 1629795376574 3 connected
4cc6a047f5f4f72ecced7be6b495738156e489a7 10.100.104.31:6379@16379 master - 0 1629795376000 2 connected 5461-10922
7cfa62aaf91e0c5a528b59aad46054c7f4d057ca 10.100.104.29:6379@16379 master - 0 1629795376874 3 connected 10923-16383
640844a5d9f5d27fcf308a70cf97ee8c87605330 10.100.104.32:6379@16379 slave 4cc6a047f5f4f72ecced7be6b495738156e489a7 0 1629795376574 2 connected
c2eb9dfdbdb20de0444a3fe1f78945c775dbd781 10.100.104.33:6379@16379 slave b4bd803d634042b569ff4faea3d1adee808a54f5 0 1629795375000 1 connected
b4bd803d634042b569ff4faea3d1adee808a54f5 10.100.135.26:6379@16379 myself,master - 0 1629795375000 1 connected 0-5460
```

当前主从节点如下

| 角色   | IP                    |
| ------ | --------------------- |
| master | 10.100.104.31         |
| master | 10.100.104.29         |
| master | 10.100.135.26, myself |
| slave  | 10.100.104.30         |
| slave  | 10.100.104.32         |
| slave  | 10.100.104.33         |

读写个数据试试

```bash
[root@node1 ~]# kubectl exec -it redis-cluster-leader-0 -- redis-cli -a password -c set tony stark
Defaulted container "redis-cluster-leader" out of: redis-cluster-leader, redis-exporter
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
OK
[root@node1 ~]# kubectl exec -it redis-cluster-leader-0 -- redis-cli -a password -c get tony
Defaulted container "redis-cluster-leader" out of: redis-cluster-leader, redis-exporter
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
"stark"
```

试一下master补位

```bash
[root@node1 ~]# kubectl delete pod redis-cluster-leader-0 
pod "redis-cluster-leader-0" deleted
[root@node1 ~]# kubectl exec -it redis-cluster-leader-0 -- redis-cli -a password cluster nodes
Defaulted container "redis-cluster-leader" out of: redis-cluster-leader, redis-exporter
Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe.
4cc6a047f5f4f72ecced7be6b495738156e489a7 10.100.104.31:6379@16379 master - 0 1629795657138 2 connected 5461-10922
b4bd803d634042b569ff4faea3d1adee808a54f5 10.100.135.27:6379@16379 myself,slave c2eb9dfdbdb20de0444a3fe1f78945c775dbd781 0 1629795657000 4 connected
640844a5d9f5d27fcf308a70cf97ee8c87605330 10.100.104.32:6379@16379 slave 4cc6a047f5f4f72ecced7be6b495738156e489a7 0 1629795657639 2 connected
c2eb9dfdbdb20de0444a3fe1f78945c775dbd781 10.100.104.33:6379@16379 master - 0 1629795656131 4 connected 0-5460
7cfa62aaf91e0c5a528b59aad46054c7f4d057ca 10.100.104.29:6379@16379 master - 0 1629795657138 3 connected 10923-16383
6e418e911aee8e80c9c6864591694d54fb10ccc0 10.100.104.30:6379@16379 slave 7cfa62aaf91e0c5a528b59aad46054c7f4d057ca 0 1629795656532 3 connected
```

此时的主从节点如下

| 角色   | IP                    |
| ------ | --------------------- |
| master | 10.100.104.31         |
| master | 10.100.104.29         |
| master | 10.100.104.33         |
| slave  | 10.100.104.30         |
| slave  | 10.100.104.32         |
| slave  | 10.100.135.27, myself |

至此一个简单的redis集群部署完成, 与上一篇的mysql集群一样, 这次的部署**目前仅做技术调研和测试使用, 若要进一步用于生产环境还需要做进一步论证和调整**

参考文档:

- https://helm.sh/zh/docs/
- https://www.infoq.cn/article/pPP3LRqf8BApcg3azNL3
- https://ot-container-kit.github.io/redis-operator/
