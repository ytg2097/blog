---
next: ./k8s-network
sidebar: auto
---

# k8s快速入门

> 本文为The kubernetes book的笔记. 作者Nigel Poulton, 译者[刘康](https://github.com/get-set)

K8s是一个应用编排器, 可以部署应用, 动态扩缩容, 故障自愈, 不停机回滚, 同时还是一个支撑应用运行的集群, 集群由一个或多个主节点和若干个工作节点构成. 集群内部的
DNS服务还提供了服务发现与负载均衡的能力.

k8s与容器技术是互补的技术, 容器用于应用的开发. k8s用于应用编排.
 
## 节点

集群由一个或多个主节点和若干个工作节点构成. 其中主节点负责管理整个集群, 做调度决策, 监控集群, 响应事件的工作. 工作节点负责运行应用服务, 每个工作节点都有自己的主节点.

![k8s](http://image.ytg2097.com/k8s.svg)
### 主节点 

![master-node](http://image.ytg2097.com/k8s-master-node.png)

k8s的主节点(或者说控制平面, 官方文档是这么称呼的)通常有一个或多个系统服务组成.  他为集群提供了故障转移和高可用性.

- **API Server**

k8s中所有的组件之间都通过API Server进行通信. API Server默认是一组RESTful风格的接口. 

API Server位于控制平面的最前端, 所有的指令与通信都需要通过API Server来完成. 

- **集群存储**

k8s默认使用etcd存储着整个集群的配置和状态, etcd更注重一致性.

- **Controller Manager**

Controller用于确保集群的当前状态与预期状态相匹配. Controller有很多个, 比如终端Controller, 工作节点Controller, 副本Controller(一般指Pod副本). 每个Controller都在后台启动独立的
循环监听功能. 

::: tip 循环监听逻辑
1. 获取期望状态
2. 观察当前状态
3. 对比状态
4. 调整差异使当前状态去尽量符合期望状态
::: 

Controller Manager负责创建Controller并监控他们的执行.
- **Scheduler**

调度器监听API Server来启动新的工作任务, 并将其分配到合适的节点中, 合适与否由调度器判定. 判定条件有:节点是否存活, 任务依赖端口在节点中是否可用, 节点是否还有足够资源等等.
- **Cloud Controller Manager**

如果集群运行在公有云平台, 控制平面会启动一个Cloud Controller Manager来负责集成底层的公有云服务. 如实例, 负载均衡等. 
### 工作节点

工作节点托管作为应用负载的Pod. 

- **kubelet**

kubelet是工作节点的核心, 新的工作节点加入集群后, kubelet就会被部署到新节点上. 

kubelet负责向集群汇报当前节点的资源状态, 如CPU, 内存等. 

kubelet还会监听API Server分配的新任务, 每监听到一个就去执行这个任务, 并且与主节点维护一个通信频道, 当任务结束后返回执行结果. 

- **Container Runtime**

容器运行时供kubelet使用, 用于执行依赖容器的任务. 容器运行时可以由docker提供, 也可以由containerd或其他容器技术提供.

> containerd是docker的精简版, 在某些时候更适合作为k8s的容器运行时.

- **kube-proxy**

kube-proxy与kubelet和Container Runtime一样在每个工作节点中都存在, 它是维护节点上的网络规则, 允许从集群内部或外部与Pod进行网络通信. 

## DNS/网络 

K8s有自己的DNS, 他有一个静态IP, 并且被硬编码在每个节点中. 他让我们可以使用一致的DNS名称而非IP地址来访问服务. 集群中的每个Service都会有一个DNS名称. 

## 声明式模型

当我们要将一个应用运行在k8s上时, 通常需要先将应用打包为镜像, 然后封装到pod中去运行. 我们可以通过定义manifest文件(yml)的方式去部署. 

我们在yml中告知k8s集群我们希望的应用运行状态. 也就是期望状态. 比如运行多少个副本. 然后提交到k8s中. k8s会确保应用的运行符合我们的期望状态. 

整个流程如下: 

1. 在mainfest文件中声明一个应用的期望达到的状态
2. 将manifest文件发送到API服务
3. k8s将manifest存储到集群存储中, 并作为应用的期望状态
4. k8s在集群中实现期望状态
5. k8s启动循环监听, 保证当前状态符合期望状态
> 循环监听会有很多个, 有监听副本数量的, 有监听存储卷挂载的, 下面会有讲解. 

## Pod

![k8s-pod](http://image.ytg2097.com/k8s-pod.png)
pod是k8s调度的原子单位, 就像容器是docker调度的原子单位一样.

k8s是无法直接运行容器的, 它使用pod来对容器进行一层简单的封装, 以允许容器运行在k8s中. pod就是为用户在宿主机系统中划出一部分区域, 构建一个网络栈, 创建一组内核命名空间, 并且在其中运行一个或多个容器. 

pod中可以包含一个或多个容器, 或者说pod是被一个或多个容器共享的执行环境. 比如我们可以一个pod包含一个微服务, 
也可以在一个pod中同时包含微服务与其依赖的基础设施服务(打比方, 通常不会这么做). **注意是包含不是运行** 

pod的部署是原子操作, 只有pod中的容器都启动成功运行后, pod提供的服务才被认为可用. 

由于pod运行中可能会出现意外销毁, 而k8s的自愈功能会启动一个新pod来取到原pod(pod本身没有这个能力, Deployment才有). 新的pod会有**新的id与新的ip**, 所以我们**切记不要在程序中去
依赖某个特定的pod**

### manifest

在声明式模型中提到我们可以使用manifest文件的方式去告诉k8s部署一个什么样的应用, 下面简单配置一个manifest.
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-pod
  labels:
    zone: prod
    version: v1
spec:
  containers:
  - name: hello-ctr
    image: nigelpoulton/k8sbook:latest
    ports:
    - containerPort: 8080
```
- apiVersion: 创建部署对象的API组合API版本. 值得格式应该是&lt;api-group&gt;-&lt;version&gt;. 在k8s的manifest文件中, apiGroup可以省略不写, 默认是core. 也就是`apiVersion:V1`等价于
`apiVersion:core/v1` 
- kind: 通知k8s要部署的对象类型. kind的value是一个枚举, 可选的值有`Namespace`, `Service`, `Pod`, `Deployment`, `PersistentVolume`等等. 这里写`Pod`, 表示要部署一个Pod对象.
- metadata: metadata中定义的信息用于在集群中识别被部署的对象. 这里定义Pod对象的名称为hello-pod. 同时为其赋予了两个标签`zone: prod`, `version: v1`. 以便与Service建立关联, 后续会讲到.
- spec: spec=special, spec中定义Pod对象中要运行的容器以及相关配置, 如挂载卷, 启动副本数量等等. 这里指定运行一个image为`nigelpoulton/k8sbook:latest`的容器, 暴露8080端口, 并取名为hello-ctr

### deploy

在编写完manifest文件后. 我们需要将这个文件提交给k8s去让他运行把Pod副本到可以工作的节点上去. 下面是会涉及到的一些kubectl与API Server交互的一些命令. 

```bash
# POST manifest文件到API Serve
F:\学习\k8s\TheK8sBook\pods>kubectl apply -f pod.yml  
pod/hello-pod created

# 查看部署的pod
F:\学习\k8s\TheK8sBook\pods>kubectl get pods
NAME        READY   STATUS    RESTARTS   AGE
hello-pod   1/1     Running   0          66s
``` 

当看到pod的状态为Running时, 代表pod已经在k8s中运行了. 我们可以使用`kubectl exec`命令进入pod操作, 也可以使用`kubectl logs`命令查看pod的日志. 这一点与docker大同小异. 不再赘述.

上面用到的`kubectl apply -f`命令是通用的k8s的manifest文件部署启动命令, 除了启动Pod以外, 启动后面会讲到的所有的k8s对象的manifest文件也都是通过这个命令来部署.

还有`kubectl get`命令也是通用. `kubectl describe`命令则可以更详细的查看k8s对象的信息. 

## Deployment

Pod对象本身是没有故障自愈, 滚动升级等能力的. 所以Pod的部署一般是通过更上层的Deployment来完成的. 它是对Pod的更进一步的封装, 提供了扩缩容管理, 不停机更新和版本控制功能.

**一个Deployment对象只能管理一个Pod模版**, 如果有多个Pod对象, 那么每个Pod对象都应该有自己的Deployment

Deployment的内部使用ReplicaSet对象来完成Pod的自愈, 滚动升级等, 他是声明式模型(期望状态)实现的关键, 它实现了监视循环. 

当滚动升级的时候, Deployment会保留原来的ReplicaSet对象的情况下, 启动一个新的ReplicaSet对象来启动新的Pod副本, 如果需要回滚, 只需要停止新的ReplicaSet, 然后启动旧ReplicaSet就可以了.

![k8s-replicaSet](http://image.ytg2097.com/k8s-replicaSet.png)

### manifest

下面定义一个deploy.yml文件来通过Deployment对象启动一组pod对象
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-deploy
spec:
  replicas: 10
  selector:
    matchLabels:
      app: hello-world
  minReadySeconds: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: hello-world
    spec:
      containers:
      - name: hello-pod
        image: nigelpoulton/k8sbook:latest
        ports:
        - containerPort: 8080
```
apiVersion与kind和metadata属性不再赘述. 都是k8s对象manifest的通用属性. 这里只解释spec中的信息含义

- replicas: 表示要部署多少pod副本
- selector: 表示这个Deployment对象下所管理的Pod副本需要具备哪些标签. 
- minReadySeconds: 这个属性表示在逐个更新Pod时, 每个Pod更新间隔的时间是多少, 定义这个属性可以避免一次性全部更新Pod时出现问题而不易追踪问题
- strategy: 表示使用滚动更新的策略, 下面的`maxUnavailable`和`maxSurge`参数表示滚动更新Pod时, 不能出现比期望状态多出一个以上或少一个以上pod的情况. 结合`replicas: 10`来说就是滚动更新时运行中的pod不能少于9个也不能多于11个.
- template: 这里定义的是Deployment对象所管理的Pod的具体属性, 参考Pod.yml

### deploy

使用如下命令来提交一个Deployment:

```bash
# POST manifest文件到API Server
F:\学习\k8s\TheK8sBook\deployments>kubectl apply -f deploy.yml
deployment.apps/hello-deploy created

# READY列中为已启动数量/预期启动数量
F:\学习\k8s\TheK8sBook\deployments>kubectl get deploy
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
hello-deploy   4/10    10           0           11s

# 所有pod副本启动完毕
F:\学习\k8s\TheK8sBook\deployments>kubectl get pods
NAME                            READY   STATUS    RESTARTS   AGE
hello-deploy-65cbc9474c-2qmkz   1/1     Running   0          58s
hello-deploy-65cbc9474c-669rg   1/1     Running   0          58s
hello-deploy-65cbc9474c-9nzp7   1/1     Running   0          58s
hello-deploy-65cbc9474c-f9hhd   1/1     Running   0          58s
hello-deploy-65cbc9474c-gknps   1/1     Running   0          58s
hello-deploy-65cbc9474c-lq9cz   1/1     Running   0          58s
hello-deploy-65cbc9474c-m6r2l   1/1     Running   0          58s
hello-deploy-65cbc9474c-mfgqx   1/1     Running   0          58s
hello-deploy-65cbc9474c-pc7tg   1/1     Running   0          58s
hello-deploy-65cbc9474c-r8ztb   1/1     Running   0          58s
```

### RollingUpdate

当修改manifest文件后再次执行apply命令提交. 然后使用`kubectl rollout status`命令查看更新过程

```bash
F:\学习\k8s\TheK8sBook\deployments>kubectl rollout status deployment hello-deploy
Waiting for deployment "hello-deploy" rollout to finish: 4 of 10 updated replicas are available...
Waiting for deployment "hello-deploy" rollout to finish: 9 of 10 updated replicas are available...
```

### Rollback

执行回滚操作需要一个deploy的版本号. 这个版本号可以在执行apply命令时通过`--record`参数记录下来. 然后通过一下命令查看历史版本号

```bash 
F:\学习\k8s\TheK8sBook\deployments>kubectl rollout history deployment hello-deploy
deployment.apps/hello-deploy
REVISION  CHANGE-CAUSE
1         <none>
2         kubectl apply --filename=deploy.yml --record=true
```
因为我们已经执行过了一次滚动升级, 所以hello-deploy对象中现在应该有两个ReplicaSet对象

```bash
F:\学习\k8s\TheK8sBook\deployments>kubectl get rs
NAME                      DESIRED   CURRENT   READY   AGE
hello-deploy-65cbc9474c   0         0         0       16m
hello-deploy-6f797c4b74   10        10        10      3m15s
```
可以看到更早创建的hello-deploy-65cbc9474c中Pod副本数量已经为零, 新创建的hello-deploy-6f797c4b74中Pod数量为10. 

现在通过undo命令回滚版本

```bash
F:\学习\k8s\TheK8sBook\deployments>kubectl rollout undo deployment hello-deploy --to-revision=1
deployment.apps/hello-deploy rolled back
```

再次查看ReplicaSet对象, 旧的ReplicaSet中的Pod对象已经开始逐个启动, 新的ReplicaSet中的Pod对象开始逐个销毁

```bash 
F:\学习\k8s\TheK8sBook\deployments>kubectl get rs
NAME                      DESIRED   CURRENT   READY   AGE
hello-deploy-65cbc9474c   3         3         2       20m
hello-deploy-6f797c4b74   8         8         8       6m59s
``` 

## Service

由于Pod可能会出现扩缩容, 故障时替换的情况, 导致了Pod的IP地址变化. 因此Pod时不可靠的, 我们不能直接去依赖Pod. Service解决了这个问题, 它提供了稳定的网络. 

![k8s-service](http://image.ytg2097.com/k8s-service.png)
我们可以把Service对象想象为具备前后两端. 前端有自己的DNS名称, IP和端口号; 后端有对Pod的动态负载均衡机制, 并且实现了自我监控, 可以自动更新.
![k8s-service](http://image.ytg2097.com/k8s-servoce-selector.png)
Service使用标签和标签选择器来决定将流量负载均衡到哪个Pod.

### Endpoint

Service在创建后都会得到一个关联的Endpoint对象, 这个对象是一个动态的列表, 包含了所有匹配Service Selector的健康Pod.

当Service有流量需要转发时, 通过Endpoint对象中的Pod列表来查找Pod

启动会Service后可以查看对应的Endpint对象

```bash
F:\学习\k8s\TheK8sBook\services>kubectl get ep hello-svc
NAME        ENDPOINTS                                                  AGE
hello-svc   10.1.0.37:8080,10.1.0.38:8080,10.1.0.39:8080 + 7 more...   9m21s
```

### type

Service有多种类型, 不同类型的Service对应不同的外部访问策略

- **ClusterIP**

ClusterIP类型的Service有固定的IP和端口号, **只能从集群的内部访问**.

ClusterIP与Service名称一起被注册到集群内部的DNS服务中. 因为所有Pod都知道集群的DNS服务, 所以所有的Pod都能够解析Service名称. 之所以是内部访问是因为要访问集群的DNS才能够找到对应的IP, 
所以ClusterIP类型的Service只对Pod和集群中的其他对象奏效.

- **NodePort**

NodePort在ClusterIP的基础上增加了外部访问的能力. 

NodePort在集群的人与节点上都是相同的, 也就是从集群外部访问任一节点上的NodePort指定的端口号都可以找到Service, 即使这个节点上并没有Service及其选择器对应的Pod

集群内部的Pod找到Service要通过名称, 而外部的则是通过NodePort.

NodePort的端口范围在30000-32767之间
- **LoadBalancer**

LoadBalancer同样能够在外部访问, 同时他还能够与云服务上提供的负载均衡服务集成. 他是基于NodePort实现的.
- **ExternalName**

ExternalName能够将流量路由到k8s之外的系统

### manifest

前面的实例中已经通过Deployment部署了10个监听8080端口的Pod. 但是因为没有配置网络, 所以我们通过宿主机IP+8080并不能访问到内部的Pod. 正好可以通过NodePort Service的方式去接收流量. 

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hello-svc
  labels:
    app: hello-world
spec:
  type: NodePort
  ports:
  - port: 8080
    nodePort: 30001
    targetPort: 8080
    protocol: TCP
  selector:
    app: hello-world
```
metadata中的labels并不是用来筛选Pod的, 而是用来匹配Service的. 

spec中定义信息解释:

- type: 表明service类型为NodePort, 可被集群外访问
- ports: 
    - port: 指的是Service暴露在ClusterIP上的端口号. 这是提供给集群内部来使用的. 
    - nodePort: 对外监听30001端口, 也就是集群外部通过&lt;集群任意节点IP&gt;:30001就可以访问到这个Service对象
    - targetPort: 当收到请求后, 将流量路由到Pod的8080端口上
    - protocol: 使用TCP协议, 这也是默认的
- selector: 上面ports中配置的流量路由策略会作用到标签含有app=hello-world的pod上  

通过apply提交后访问http://127.0.0.1:30001
![k8s-service-nodeport](http://image.ytg2097.com/k8s-servoce-nodeport.png)  

使用logs命令可以查看这次流量被路由到了哪个节点
```bash
F:\学习\k8s\TheK8sBook\services>kubectl logs -f service/hello-svc
Found 10 pods, using pod/hello-deploy-65cbc9474c-77xx9
```

## 服务注册与服务发现

> 填坑之前[微服务专栏](../microservice/contact.md#平台服务发现模式)中提到的虚拟IP实现服务发现部分

### 服务注册
k8s内部使用一个DNS服务作为服务注册中心, 他实际上是运行在kube-system命名空间中的一个名为coredns的由Deployment管理的一组Pod. 是k8s的原生应用.

```bash 
F:\学习\k8s\TheK8sBook\services>kubectl get pods -n kube-system -l k8s-app=kube-dns
NAME                      READY   STATUS    RESTARTS   AGE
coredns-f9fd979d6-9sg5x   1/1     Running   0          3h3m
coredns-f9fd979d6-bpkhw   1/1     Running   0          3h3m
```

1. POST Service的manifest文件到API Server
2. Service被分配ClusterIP
3. 配置持久化到集群存储
4. Endpoint对象被创建
5. 集群的DNS发现新的Service
> DNS内部有一个Controller会监听API Server
6. 创建新的DNS记录
7. 每个节点上的kube proxy拉取Service配置
8. 创建IPVS规则
> 每个节点的kubelet进程都会监视Endpoint对象的创建

### 服务发现

k8s会自动配置所有容器, 让他们能够找到集群的DNS, 并用来将Service名字解析为ClusterIP. 实际操作是k8s为每个容器都注入了一个/etc/resolv.conf. 

1. 通过DNS解析到Service对应的ClusterIP
2. 将流量发送到ClusterIP
3. 但是没有路由, 将流量发送到容器的默认网关
> 因为这个ClusterIP是在一个特殊的名为servicenetwork的网络上, 是没有路由可达的, 所以容器不知道该把流量发到哪, 只能发送到默认网关. 
4. 转发到集群节点
5. 集群节点也没有路由, 在转发到节点的默认网关
> 由于主机节点同样没有servicenetwork的路由, 所以只能再发往自身的默认网关. 
6. 流量被节点内核处理
7. 流量被IPVS规则捕获
8. 将流量发往的目标IP重写为Pod的IP

### 故障排查

由于k8s使用集群内置DNS服务作为服务的注册中心使用, 所以如果有服务注册发现相关的问题应该先排查这里.

集群的DNS是一组运行在kube-system命名空间中的pod和一个用来提供稳定网络入库的Service对象构成. 他主要包括三个组件:
- pods: 由coredns Deployment管理
- Service: 一个名为kube-dns的ClusterIP Service, 监听TCP/UDP 53端口
- Endpoint: 也叫kube-dns

所有与集群DNS相关的对象都有一个k8s-app=kube-dns的标签. 这个需要记住. 方便命令排查.

针对DNS的排查过程如下:

1. 先确定coredns Deployment及其管理的pods运行状态.
2. 查看coredns的每个pod的日志
3. 查看Service是否在运行中, 且监听端口是53, 且有ClusterIP
4. 查看Endpoint对象是否正在运行且拥有所有coredns pod的IP地址

当DNS排查没有问题后, 可以再通过启动一个单例的名为dnsutils的pod来排查. 这个pod中内置了一些常用的网络工具如ping, curl, nslookup.

## 存储

k8s的存储与docker的存储不一样, 它要复杂的多, pod将资源挂载到外部存储需要很多个步骤, 不过也正因如此, k8s对存储的控制也更灵活多变. 

k8s的存储分为三部分: **持久化卷子系统, 插件, 存储提供者**. 

![k8s-storage](http://image.ytg2097.com/k8s-storage.png)

pod对象通过持久化卷子系统来完成数据与外部存储的挂载. 而k8s的持久化卷子系统通过插件层访问存储提供者. 

持久化卷中有三个主要的组件: **PV: 持久化卷, PVC: 持久化卷的访问许可, CS: 存储类**.


### Volume
k8s为不同的部署环境, 使用需求提供了支持非常多的卷类型. 主要分为两类: 节点宿主机存储与节点外存储. 

节点外存储有`awsElasticBlockStore(亚马逊ES卷存储)`, `azureDisk(微软Azure)`等等等等.

节点宿主机存储如`hostPath`, `local`则是将节点宿主机的文件系统上的文件或目录挂载到使用这个卷的Pod中. 

卷不能挂载到其他卷之上, 也不能与其他卷有硬连接. Pod配置中的每个容器都必须独立指定各个卷的挂在位置. 

#### manifest

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
    - image: busybox
      name: test-container
      command: ["sleep", "3000"]
      volumeMounts:
        - mountPath: /test-pd
          name: test-volume
  volumes:
    - name: test-volume
      hostPath:
        # 宿主上目录位置
        path: /data
```
在这个声明Pod的模版中的spec部分一并声明了一个hostPath的卷, 指定挂载到主机的/data目录下
### Persistent Volume

k8s中的PV对象不像docker, 它可以绑定本地磁盘以及其他外部存储, 他定义了集群的存储采用什么介质. 

一个外部存储只能被一个PV使用, 一个PV可以被多个POD访问, 但是要定义规则来确保正常访问, 同时Pod不能直接访问PV, 必须经过PVC.PV对象可以通过PVC对Pod实现共享.

**PV**有三种访问模式: 

- ReadWriteOnce: 限制一个PV只能以读写方式绑定到一个PVC上, 如果尝试绑定到多个PVC将会失败.
- ReadWriteMany: 允许一个PV以读写方式挂载到多个PVC上, 这种模式只支持NFS这样的文件或对象存储.
- ReadOnlyMany: 允许以只读方式挂载到多个PVC上

PV的核心是一个目录, 其中可能存有数据, Pod中的容器可以访问这个目录中的数据, 所采用的特定的卷类型将决定目录如何形成, 使用何种介质保存数据以及目录中存放的内容. 

PV可以事先通过manifest文件提供, 也可以通过SC动态创建. 他的生命周期独立于使用它的Pod.

#### manifest

```yaml 
apiVersion: v1
kind: PersistentVolume
metadata:
  name: test-pv
  labels:
    type: local
spec:
  storageClassName: manual
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /data
```
这个文件的声明含义是挂载主机的/data目录上, 并且只占用10G存储空间; 除此之外, 对PVC允许的访问模式是ReadWriteOnce. storageClassName指定为manual. 后面的SC部分会将. 

### PVC 

Persistent Volume Claim表达的是Pod对PV的使用请求. 概念与Pod相似. Pod会占用节点的资源, 而PVC**申领**会占用PV的资源. Pod可以请求特定数量的资源如CPU和内存. PVC申领也可以请求特定的大小和访问模式. 

当pod通过PVC访问PV时, 可以选择将PV中的某个目录挂载到pod中的容器目录上. 

当不再使用PV时, 我们可以通知API Server将PVC删除, 来回收再利用资源. PVC有三种回收策略来告诉集群, 当PV从申领中释放时应该如何处理这个数据卷. 

- **Retain**: 保留PV对象以及外部存储中的资源, 但是这回导致其他PVC无法继续使用这个PV. 如果要重复使用这个PV占用的存储, 可以手动删除PV对象. PV对象绑定的外部存储中的数据是会保留的. 
- **Delete**: 删除PVC时, 同时将PV以及PV在外部存储中的资源删除. 这是**默认**的.

#### manifest 

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pv-claim
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 3Gi
```
这个文件的含义是PVC申领storageClassName为manual的PV对象大小为3G的存储空间. 这里spec.storageClassName要与PV的manifest中的spec.storageClassName相对应. 

accessModes声明为rwo, 将会去寻找相同storageClassName下的支持row访问模式的PV对象. 

在执行apply提交后, 控制平面将会查找有相同storageClassName的且满足申领要求的PV对象, 如果找的到, 则绑定到那个PV对象上. 否则将会一直处于Pending状态

```bash
F:\学习\k8s\TheK8sBook\storage>kubectl get pvc
NAME            STATUS   VOLUME    CAPACITY   ACCESS MODES   STORAGECLASS   AGE
test-pv-claim   Bound    test-pv   10Gi       RWO            manual         2s
``` 

Pod使用PVC:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: task-pv-pod
spec:
  volumes:
    - name: test-pv-storage
      persistentVolumeClaim:
        claimName: test-pv-claim
  containers:
    - name: test-pv-container
      image: busybox
      command: ["sleep","3000"]
      volumeMounts:
        - mountPath: "/test-vol"
          name: test-pv-storage
```
spec.volumes中不再使用hostPath. 使用persistentVolumeClaim去指定要使用的PVC. 
### SC

在大规模集群中, 手动创建大量PV和PVC是非常烦琐的. 这时可以使用StorageClass来动态分配. SC可以让我们不用手动创建PV, 只需要创建一个SC对象, 然后使用一个插件与
具体的某个存储后端联系起来. 

SC创建后会观察API Server上是否有新的被关联的PVC对象, 如果匹配的PVC出现, SC会自动在后端存储系统上创建所需要的卷,以及在k8s上创建PV. 

SC还有一个重要的作用是减少PVC对PV的详细信息的依赖.
#### manifest

还是在本地测试一下
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```
在定义SC的manifest时注意apiVersion为`storage.k8s.io/v1`

- provisioner: 表示不使用外部存储, 采用本地存储
- volumeBindingMode: 表示延迟绑定. PVC与PV的绑定被延迟到Pod的第一次调度时.

SC对象是不可变得, 在部署之后不可以再修改. 

定义一个PVC对象供Pod使用
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pv-ticket
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: local-storage
  resources:
    requests:
      storage: 1Gi
```
部署之后查看PVC状态处于Pending, 也就是等待绑定的状态. 

再启动一个Pod的使用PVC
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: class-pod
spec:
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: pv-ticket
  containers:
  - name: ubuntu-ctr
    image: ubuntu:latest
    command:
    - /bin/bash
    - "-c"
    - "sleep 60m"
    volumeMounts:
    - mountPath: /data
      name: data
```
发现启动报错
```bash 
  Type     Reason            Age    From               Message
  ----     ------            ----   ----               -------
  Warning  FailedScheduling  10m    default-scheduler  0/1 nodes are available: 1 node(s) didn't find available persistent volumes to bind.
  Warning  FailedScheduling  10m    default-scheduler  0/1 nodes are available: 1 node(s) didn't find available persistent volumes to bind.
```
这是因为本地卷还不支持动态制备. 所以我们要先提供一个PV.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-storage-pv
  labels:
    type: local
spec:
  storageClassName: local-storage
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: /tmp
```

再次查看Pod状态已经运行成功. 

> 更多的StorageClass  https://kubernetes.io/zh/docs/concepts/storage/storage-classes/
## ConfigMap

ConfigMap对象将配置数据从Pod中剥离出来. 并可以动态的在Pod运行时注入数据. 

### 创建方式

- **命令式**:
```bash 
F:\学习\k8s\TheK8sBook\storage>kubectl create configmap profile --from-literal name=杨同港 --from-literal wx=ytg2097
configmap/profile created


```
- **声明式**:

```bash
F:\学习\k8s\TheK8sBook\storage>kubectl create cm profile-json --from-file=profile.json
configmap/profile-json created
```
```json
{
  "姓名": "杨同港",
  "微信号": "ytg2097"
}
```

### 注入方式

- **环境变量**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    chapter: configmaps
  name: envpod
spec:
  restartPolicy: OnFailure
  containers:
    - name: ctr1
      image: busybox
      command: [  "sleep", "300" ]
      env:
        - name: WX
          valueFrom:
            configMapKeyRef:
              name: profile
              key: wx
        - name: NAME
          valueFrom:
            configMapKeyRef:
              name: profile
              key: name
```
查看环境变量
```bash 
F:\学习\k8s\TheK8sBook\configmaps>kubectl exec -it envpod sh
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
/ # echo name:$NAME  wx: $WX
name:杨同港 wx: ytg2097
```
- **容器启动命令参数**:

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    chapter: configmaps
  name: envpod
spec:
  restartPolicy: OnFailure
  containers:
    - name: ctr1
      image: busybox
      command: [ "/bin/sh", "-c", "echo 博客作者: $(NAME) 微信号 $(WX) 济南的爷就是爷, 除了吃就是玩, 没别哒!" ]
      env:
        - name: WX
          valueFrom:
            configMapKeyRef:
              name: profile
              key: wx
        - name: NAME
          valueFrom:
            configMapKeyRef:
              name: profile
              key: name
```

```bash 
F:\学习\k8s\TheK8sBook\configmaps>kubectl apply -f envpod.yml
pod/envpod created

F:\学习\k8s\TheK8sBook\configmaps>kubectl logs -f envpod
博客作者: 杨同港 微信号 ytg2097 济南的爷就是爷, 除了吃就是玩, 没别哒!
```
- **某个卷上的文件**:
这个很好理解. 我们使用卷挂载方式访问数据无非是将应用运行时产生数据保存. 和应用运行时读取两种用途. 

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cmvol
spec:
  volumes:
    - name: volmap
      configMap:
        name: profile
  containers:
    - name: ctr
      image: nginx
      volumeMounts:
        - name: volmap
          mountPath: /etc/name
```
```bash
F:\学习\k8s\TheK8sBook\configmaps>kubectl exec -it cmvol ls /etc/name
kubectl exec [POD] [COMMAND] is DEPRECATED and will be removed in a future version. Use kubectl exec [POD] -- [COMMAND] instead.
name  wx
```
## StatefulSet

StatefulSet也是k8s中的一等公民, 与Deployment的具备相同的能力, 可以管理Pod, 进行动态扩缩容, 故障自愈, 滚动升级. 

### 不同点

- **Pod名字可预知且保持不变**
原因是StatefulSet启动Pod是有顺序的, Pod的命名是&lt;StatefulSet名称&gt;-&lt;1&gt;,&lt;StatefulSet名称&gt;-&lt;2&gt;,&lt;StatefulSet名称&gt;-&lt;n&gt;
- **DNS主机名可预知保持不变**
DNS的主机名就是StatefulSet的名称
- **卷绑定可预知保持不变**

以上三个特性在哪些要求Pod保持不变的应用中非常有用. 

### headlessService

由StatefulSet部署的Pod是可预知的. 所以我们的一些应用可能会直接连接到某个Pod上去. 为了实现这一功能, k8s提供了一个特殊的Service对象headlessService来为StatefulSet使用headlessService来为StatefulSet中的每个Pod副本创建一个可预知的DNS主机名.

headlessService是一个将spec.clusterIP设置为None的Service对象. 当这个headlessService设置为StatefulSet的`spec.service.Name`时就成为了StatefulSet的governingService. 

### volumeClaimTemplate

在使用StatefulSet时, 如果没有Pod有独立存储的需求时, 可以使用volumeClaimTemplates. 

volumeClaimTemplate在每次创建一个新的Pod副本时, 会自动创建一个PVC, 还会自动为PVC命名, 用来准确关联Pod, PVC名为&lt;volumeClaimTemplate名称&gt;-&lt;Pod名&gt;

> 更多内容见官方文档  https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/

::: warning 注意
在删除StatefulSet之前最好先缩容Pod副本数量到0来保证本地缓存安全落库
:::



