---
prev: ./
sidebar: auto
---
# k8s部署Elasticsearch集群

elasticsearch官方已经推出一个k8s operator: Elastic Cloud On Kubernetes. 简称ECK.

ECK中集成了大量es的运维工作:

- 管理和监测多个集群
- 轻松升级至新的版本
- 扩大或缩小集群容量
- 更改集群配置
- 动态调整本地存储的规模（包括 Elastic Local Volume（一款本地存储驱动器））
- 备份

## 安装ECK Operator

ECK Operator里边也还是跟mysql, redis一样的东西包括headlessService, service, statefulset.

**安装ECK Operator要注意与k8s的版本是否匹配**, 我的k8s版本是1.21, 部署ECK Operator时官方推荐版本是1.7.1

```sh
kubectl create -f https://download.elastic.co/downloads/eck/1.7.1/crds.yaml
kubectl apply -f https://download.elastic.co/downloads/eck/1.7.1/operator.yaml
```

只需要两条命令就可以安装完成

验证一下是否安装成功

```sh
[root@node1 ~]# kubectl get pods -n elastic-system
NAME                 READY   STATUS    RESTARTS   AGE
elastic-operator-0   1/1     Running   1          123m
```

## 部署ES集群

es-quickstart.yml

```yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: quickstart
spec:
  version: 7.14.0
  nodeSets:
  - name: default
    count: 1
    config:
      node.store.allow_mmap: false
```

apply之后发现报错

```bash
[root@node1 ~]# kubectl get elasticsearch
NAME         HEALTH    NODES   VERSION   PHASE             AGE
quickstart   unknown           7.14.0    ApplyingChanges   15h
[root@node1 ~]# kubectl get pods | grep es
quickstart-es-default-0                   0/1     Pending   0          15h
[root@node1 ~]# kubectl describe pod quickstart-es-default-0
...
Events:
  Type     Reason            Age   From               Message
  ----     ------            ----  ----               -------
  Warning  FailedScheduling  70m   default-scheduler  0/3 nodes are available: 1 node(s) had taint {node-role.kubernetes.io/master: }, that the pod didn't tolerate, 2 Insufficient memory.
```

elasticsearch对象quickstart的HEALTH状态为unknown. 再查看es的pod, events中报错: `1 node(s) had taint {node-role.kubernetes.io/master: }, that the pod didn't tolerate, 2 Insufficient memory.`

当前的k8s节点如下

| 节点  | 角色   | IP             | 配置  |
| ----- | ------ | -------------- | ----- |
| node1 | master | 192.168.58.136 | 2C 4G |
| node2 | worker | 192.168.58.137 | 2C 4G |
| node3 | worker | 192.168.58.138 | 2C 4G |

集群的三个节点都不能用于调度Pod, 其中提示master节点有一个污点, es的pod不能容忍这类污点. 而另外两个节点的内存不足. 所以Pod调度失败, 一直出于Pending状态.

```bash
[root@node1 ~]# kubectl describe node node1 | grep Taint
Taints:             node-role.kubernetes.io/master:NoSchedule
```

这个问题有4个解决方案:

| 方案                       | 采纳建议                                                     |
| -------------------------- | ------------------------------------------------------------ |
| 抹除master的污点           | master节点的污点是k8s集群搭建时候默认打上的, 也是为了强调master节点和worker节点的区别, 最好还是不要让master去承担worker的工作 |
| 调整quickstart的污点容忍度 | 同上, 最好把pod调度到master上边去, 如果污点所在的节点是在worker上, 可以考虑调整 |
| 调整两个worker节点的资源   | 如果资源充沛  可以考虑                                       |
| 限制quickstart的资源       | 限制资源之后可以满足es运行需求的话, 可以考虑                 |

**最终采用的是第四个.**

在调整quickstart资源之前先了解一下k8s的污点和污点容忍度

## 污点与容忍度

k8s节点上的污点并不是说节点状态有异常. k8s官方文档中对污点的解释如下:

[节点亲和性](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/assign-pod-node/#affinity-and-anti-affinity) 是 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 的一种属性，它使 Pod 被吸引到一类特定的[节点](https://kubernetes.io/zh/docs/concepts/architecture/nodes/) （这可能出于一种偏好，也可能是硬性要求）。 *污点*（Taint）则相反——它使节点能够排斥一类特定的 Pod。

容忍度（Toleration）是应用于 Pod 上的，允许（但并不要求）Pod 调度到带有与之匹配的污点的节点上。

污点和容忍度（Toleration）相互配合，可以用来避免 Pod 被分配到不合适的节点上。 每个节点上都可以应用一个或多个污点，这表示对于那些不能容忍这些污点的 Pod，是不会被该节点接受的.

污点有三种级别:

- NoSchedule: 不能容忍此污点的Pod不会被调度到节点上; 现有的Pod不会从节点中逐出. k8s的master节点默认带有NoSchedule污点
- PreferNoSchedule: k8s会避免不能容忍此污点的Pod被调度到节点上
- NoExecute: 如果Pod已经在节点上运行了, 那么Pod会被从节点上逐出; 如果未在节点上运行, 则不会被调度到节点上

操作节点的污点:

```bash
# 添加污点
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value1:NoExecute
kubectl taint nodes node1 key2=value2:NoSchedule
# 移除污点的命令是在添加污点的命令后面加一个减号
kubectl taint nodes node1 key2=value2:NoSchedule-
```

调整pod的容忍度

```yaml
# 与containers同级
tolerations:
# operator为Equal表示 当key和value相同时, 
- key: "key1"
  # 当节点的key=value时, 即使节点上污点级别是NoSchedule, Pod也会被调度到那个节点上去 
  operator: "Equal"
  value: "value1"
  effect: "NoSchedule"
```

```yaml
# 与containers同级
tolerations:
# operator为Equal表示 当key和value相同时, 
- key: "node-role.kubernetes.io/master"
  # 只要节点上存在key1, 即使节点上污点级别是NoSchedule, Pod也会被调度到那个节点上去 
  operator: "Exists"
  effect: "NoSchedule"
```

---

## 调整Pod资源

### 1. 先查看节点中可用资源

查看k8s的资源状态不能使用free -m这类工具, 因为 `free -m` 不能在容器中工作，并且如果用户使用了 [节点可分配资源](https://kubernetes.io/zh/docs/tasks/administer-cluster/reserve-compute-resources/#node-allocatable) 特性，资源不足的判定将同时在本地 cgroup 层次结构的终端用户 Pod 部分和根节点做出.

我们可以使用kubectl top命令查看资源占用情况. (前提是先安装过metrics, 可参考腾讯的文档https://cloud.tencent.com/document/product/457/50074, metrics官方的因为墙的原因镜像pull不下来)

```bash
[root@node1 ~]# kubectl top nodes --use-protocol-buffers
NAME    CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%   
node1   659m         32%    1947Mi          53%       
node2   611m         30%    1607Mi          43%       
node3   506m         25%    2011Mi          54% 
```

### 2. 调整ES集群节点占用资源

```yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: quickstart
spec:
  version: 7.14.0
  nodeSets:
    - name: default
      config:
        node.roles:
          - master
          - data
        node.attr.attr_name: attr_value
        node.store.allow_mmap: false
      podTemplate:
        metadata:
          labels:
            foo: bar
        spec:
          containers:
            - name: elasticsearch
              resources:
                requests:
                  # ECK Operator默认申请4g内存
                  memory: 1Gi
                  cpu: 1
                limits:
                  memory: 1Gi
                  cpu: 1
      count: 1
```

## 部署kibana

- kinana.yml

```yaml
apiVersion: kibana.k8s.elastic.co/v1
kind: Kibana
metadata:
  name: kibana-sample
spec:
  version: 7.14.0
  count: 1
  elasticsearchRef:
    # 这里要写之前部署的elasticsearch的名字
    name: quickstart
  podTemplate:
    metadata:
      labels:
        foo: bar
    spec:
      containers:
        - name: kibana
          resources:
            requests:
              memory: 200Mi
              cpu: 0.2
            limits:
              memory: 200Mi
              cpu: 0.2
```

- kibana-ingress.yml

  需要先部署上ingressclass https://github.com/ytg2097/k8s-image/blob/main/ingress-nginx/ingress-nginx.yml

```bash
[root@node1 ~]# kubectl get svc | grep kibana
kibana-sample-kb-http             ClusterIP   10.96.197.98   <none>        5601/TCP            12m
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kibana
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: my-kibana.com
    http:
      paths:
      - backend:
          serviceName: kibana-sample-kb-http
          servicePort: 5601
        path: /
```

我是在虚拟机上跑的k8s, 所以需要分别在我的/etc/hosts和本机C:\Windows\System32\drivers\etc\hosts里面都配上域名解析. 然后就可以在浏览器访问了

