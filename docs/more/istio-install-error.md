---
sidebar: auto
---

# 记一次部署Istio遇到的问题

按照[官方文档](https://istio.io/latest/zh/docs/setup/getting-started/)在虚拟机一主二从k8s环境中部署Istio时遇到**`Istiod encountered an error: failed to wait for resource: resources not ready after 5m0s: timed out waiting for the condition`**问题.

详细报错信息如下:

```shell
[root@node1 deployment]# istioctl install --set profile=demo -y
✔ Istio core installed
Processing resources for Istiod. Waiting for Deployment/service-mesh-system/istiod                                                               
✘ Istiod encountered an error: failed to wait for resource: resources not ready after 5m0s: timed out waiting for the condition
```

先google得到以下解决方案

https://stackoverflow.com/questions/64373346/istioctl-install-fails-with-multiple-timeouts

将虚拟机内存从4g调整到16g. 再次执行`istioctl install`命令, 仍然报错, 问题未能解决. 

后``kubectl get pods -n istio-system`` 查看istio的Pod的启动状态, 发现`istio-egressgateway`与 `istio-ingressgateway`两个pod全部处于`ContainerCreateing`状态. 长时间没有变化 

而后describe查看Events一直在报错, Message中主要报错内容为: `stat /var/lib/calico/nodename: no such file or directory`

并且发现除了istio的pod之外, calico的pod也在报错.  

然后查阅相关解决方案发现有人弃用calico该用flannel问题解决.  遂按步骤照做,  但是卡在了flannel安装的环节, 由于墙的原因, flannel安装失败. 

再次装回calico.

再部署一个Deployment, 其中Pod副本为10, 发现还是报错`no such file or directory /var/lib/calico/nodename`. 

```shell
[root@node1 deployment]# kubectl get pods -A
NAMESPACE      NAME                                       READY   STATUS               RESTARTS   AGE
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
default        hello-deploy-6f797c4b74-dr4cn              0/1     ContainerCreateing   0          2m16s
```

试图exec进入pod查看挂载点中nodename文件是否存在问题, 无法进入.   而后逐个查看各个宿主机中/var/lib/calico路径下文件是否存在. 

发现node3机器中/var/lib/calico路径下无任何文件, 同时calico节点的tunl0网卡也不存在.  大致明确问题所在. 

先将node3从集群中剥离:

master节点上执行:

```shell
kubectl drain node3 --delete-local-data
kubectl delete node node3
```

然后node3节点上执行:

```shell
kubeadm reset
```

而后重新get pods发现之前一直卡在ContainerCreateing状态的pod已经恢复正常进入Running状态. 

将node3重新加入节点执行kubeadm join.

集群恢复正常.  Istio安装成功

