---
prev: ./k8s
next: ./k8s-storage
sidebar: auto
---

# k8s网络二: pod通信与服务发现

## IP-per-Pod

在k8s的网络模型中, 每个节点上的上的容器有自己的ip段, 各个节点之间的容器可以根据目标容器的ip地址进行访问. 

基于上述原则, k8s抽象出一个IP-per-Pod模型. 这个模型中, IP以Pod为单位进行分配, Pod内的所有容器共享一个网络堆栈(相当于一个命名空间, 他们的IP地址, 网络设备, 配置都是相同的).
Pod的IP和端口在Pod的内部和外部都保持一致, 也就不需要NAT来进行地址转换了. 同时同一个Pod内的容器因为共享网络命名空间, 可以直接通过localhost来相互连接.

在IP-per-Pod模型下. 可以有效的利用各种域名解析和发现机制.

IP-per-Pod模型消除了Docker中的动态端口映射所带来的复杂性. 
> 在Docker的动态端口映射模式中, 因为NAT的原因访问者看到的IP端口与服务提供者实际绑定的IP端口是不一样的. 容器内应用是很难知道自身对外暴露的真实的IP和地址的. 外部应用也不能直接通过服务所在容器的私有IP和端口来访问服务.

在IP-per-Pod模式下, 一个Pod就好像一台独立的机器一样, 有自己的域名解析, 端口分配, 负载均衡, 服务发现机制. 

在这个模型下主要解决两个问题: **IP地址分配和路由.** 

### IP地址分配

在IP-per-Pod模型中, 各个服务器上的容器IP段不能重叠, k8s使用各种IP范围为Node, Pod, Service分配IP地址. 

- 从集群的VPC网络为每个Node分配一个IP地址. 
- 为每个Pod分配一个地址段内的IP地址. 
- 从集群的VPC网络中为每个Service分配一个IP地址(ClusterIP). 


## k8s网络架构

![k8s-network](../.vuepress/images/k8s-network.png)

当我们在k8s的master中创建一个pod后, kubelet观察到新pod的创建, 会先调用CRI(Container Runtime Interface)创建Pod内的若干个容器. 

在创建应用容器的同时, k8s还会为每个pod创建一个pause容器, 在前一篇的namespace中讲到维持namespace存在的方式除了文件描述符挂载的方式之外还有一种进程占用的方式. pause就是采用的这种方式. 

pause容器创建后, pod内的容器会通过container网络模式加入到这个pause的network namespace中. 

在初始化pause时, k8s的网络插件还会给pause容器内的eth0分配IP, 到时候, Pod内的其他容器就使用这个IP与其他Pod进行通信. 


## k8s的节点内组网

k8s的节点内组网与docker一样也是veth pair + bridge的方式. 

当k8s调度一个Pod在某个节点上运行的时候, 会在这个节点的linux内核中为pod创建一个network namespace, 供pod内所有运行的容器使用. 从容器的角度看, pod是一个具有网络接口的物理机器. pod内所有容器都会看到这个网络接口. 

在bridge组件搭建的网络中k8s使用veth pair将容器和宿主机的网络连接到一起, 从而使数据可以进出pod. 

## k8s的跨节点组网

跨节点组网的解决方案有bridge, overlay等. 

### bridge
![k8s-net-bridge](../.vuepress/images/k8s-net-bridge.png)

node1中pod的网段是10.1.1.0/24, 连接的网桥是10.1.1.1; node2中pod的网段是10.1.2.0/24, 连接的网桥是10.1.2.1; 

node1的路由表的第二行是
```
10.1.1.0/24 dev cni0
```
意思是, 所有目标地址是本地上pod的网络包, 都发到cni0网桥, 进而广播给pod.

node1的路由表第三行是
```
10.1.2.0/24 via 192.168.1.101
```
10.1.2.0/24是node2上pod的网段, 192.168.1.101是node2的ip; 这一行的意思是目的是10.1.2.0/24网段的网络包都发送到node2上.
然后再看node2路由表的第二行
```
10.1.2.0/24 dev cni0
```
网络包被发到node2之后发送给了node2的网桥, 进而广播给了node2上的pod. 

得出结论: **bridge网络本身不解决容器的跨机通信问题, 需要显示的书写主机路由表来映射目标容器网段和主机IP的关系, 如果集群内有n个主机, 就需要n-1条路由表记录**

### overlay

overlay是一个构建在物理网络之上的虚拟网络. 

![k8s-net-overlay](../.vuepress/images/k8s-net-overlay.png)

overlay与bridge相同之处是pod同样接在网桥上, 目标地址在本机pod网段内的网络包同样发给linux网桥cni0;
不同之处是, 目的pod在其他节点上的路由表规则
```
10.1.0.0/16 dev tun0
```

网络包全部发给了本机的tun/tap设备tun0, tun0是overlay隧道网络的入口. 

使用了这个路由规则后, 就不需要再想bridge网络一样写n-1条路由记录了.

那么网络包如何正确传递到目标主机的另外一端呢?

flannel的实现中会借助一个分布式数据库记录目标容器IP与所在主机的IP映射关系. flannel会监听tun0上的封包和解包操作. 例如node1上的容器给node2上的容器发送数据, flannel会在tun0
出将一个目标地址是192.168.1.101:8472的UDP包头封装到这个包的外层, 在网络包到达node2, 监听在node2的tun0上的flannel会捕获这个UDP包, 然后解开包头发送给本机的网桥cni0.

overlay形象一点可以理解为特殊的城际快递, 不同主机上的pod内容器通信类似发送跨城快递, 寄件人只写了详细地址(目标容器IP), 但是没有写省市区(目标容器所在的主机IP), 当快递到达本地邮局(路由表)后, 
邮局发现这个地址不在本辖区(本机容器IP端)内, 然后将快递转交给了特殊通道, 也就是tun0. 这个tun0在flannel中被监听了, flannel监听到tun0收到一个快递, 就去查看这个详细地址所在的省市区(flannel中记录了容器IP或者说PodIP与主机IP的映射关系, 
因为IP-per-Pod的原因, 所以不用担心映射重复), 将地址拼接完成后, 在把快递发送到目标省市区所在的邮局去派送到具体的容器中.

相比之下, bridge算是去中心化了, 没有flannel这样的网络插件去存储容器IP与主机IP的映射关系, 而是每个主机自己去记录去匹配.

::: tun/tap

:::

## pause 容器

在k8s节点上执行docker ps会看到很多个pause容器. pause容器可以说是k8s网络的精髓, 理解pause容器能更好的理解k8s pod的设计初衷.





2. 从一个Pod中发出的流量在到达容器所在宿主机时时, 宿主机网络层应当根据目标IP地址, 将流量转发到该IP所属IP段对应的目标节点的能力.

> Kubernetes网络权威指南这本书干货十足, 内容干练直接, 笔记几乎都是原样摘抄
