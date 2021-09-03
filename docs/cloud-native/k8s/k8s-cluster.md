---
prev: ./k8s
next: ./network
sidebar: auto
---
# 安装k8s集群

资源有限, 在本地安装一个最小的k8s集群用于学习, 一个master节点, 两个工作节点

在虚拟机中安装, 操作系统为centos7, k8s版本为1.21

目标集群:

```sh
[root@node1 opt]# kubectl get nodes
NAME    STATUS   ROLES                  AGE   VERSION
node1    Ready    control-plane,master  55m   v1.21.1
node2   Ready    <none>                 23m   v1.21.1
node3   Ready    <none>                 14m   v1.21.1
```

## 1. 预备工作

预备工作在每台机器上面都要做

### 1.1 修改hostname

hostname 不重复即可, 然后在/etc/hosts中配置与其他两台机器的域名解析

### 1.2 关闭防火墙

```sh
# 关闭防火墙
systemctl stop firewalld
systemctl disable firewalld
```
### 1.3 关闭selinux

```sh
vim /etc/sysconfig/selinux
```
修改SELINUX为disabled
```
# This file controls the state of SELinux on the system.
# SELINUX= can take one of these three values:
#     enforcing - SELinux security policy is enforced.
#     permissive - SELinux prints warnings instead of enforcing.
#     disabled - No SELinux policy is loaded.
SELINUX=disabled
# SELINUXTYPE= can take one of three values:
#     targeted - Targeted processes are protected,
#     minimum - Modification of targeted policy. Only selected processes are protected. 
#     mls - Multi Level Security protection.
SELINUXTYPE=targeted
```

### 1.4 关闭swap

```sh
vim /etc/fstab
```
注释掉 swap一行

```
#
# /etc/fstab
# Created by anaconda on Thu Jun 10 11:14:31 2021
#
# Accessible filesystems, by reference, are maintained under '/dev/disk'
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info
#
UUID=c3078e21-473f-40a2-8c40-0f282de68fd9 /                       xfs     defaults        0 0
UUID=6c7561c4-c67e-4e3e-80ac-5a187398b187 /boot                   xfs     defaults        0 0
# UUID=7a3fa9f4-b261-4128-b187-b836d86b1709 swap                    swap    defaults        0 0
```

### 1.5 安装docker

```sh
yum install docker
systemctl enable docker && systemctl start docker
```

### 1.6 安装kubeadm和kubelet

先配置kubernetes的yum源

```sh
vim /etc/yum.repos.d/kubernetes.repo
```
kubernetes.repo文件内容如下
```
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
enabled=1
gpgcheck=0
```

安装kubectl和kubeadm

```sh
yum install -y kubelet kubeadm
systemectl enable kubelet && systemctl start kubelet 
```

## 2. 初始化master节点


### 2.1 拉取镜像

获取kubeadm配置文件

```sh
kubeadm config print init-defaults > kubeadm.yml
```

修改两个配置

```yaml

apiVersion: kubeadm.k8s.io/v1beta2
bootstrapTokens:
- groups:
  - system:bootstrappers:kubeadm:default-node-token
  token: abcdef.0123456789abcdef
  ttl: 24h0m0s
  usages:
  - signing
  - authentication
kind: InitConfiguration
localAPIEndpoint:
 # 这里修改为本机ip
  advertiseAddress: 192.168.58.128
  bindPort: 6443
nodeRegistration:
  criSocket: /var/run/dockershim.sock
  name: node
  taints: null
---
apiServer:
  timeoutForControlPlane: 4m0s
apiVersion: kubeadm.k8s.io/v1beta2
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
controllerManager: {}
dns:
  type: CoreDNS
etcd:
  local:
    dataDir: /var/lib/etcd
# 这里修改为阿里云的镜像仓库    
imageRepository: registry.cn-hangzhou.aliyuncs.com/google_containers
kind: ClusterConfiguration
kubernetesVersion: 1.21.0
networking:
  dnsDomain: cluster.local
  serviceSubnet: 10.96.0.0/12
scheduler: {}
```

拉取镜像
```sh
kubeadm config images pull --config kubeadm.yml
```

在拉取coredns镜像时会报一个错, 找不到coredns镜像

```sh
[root@node1 opt]# kubeadm config images pull --config kubeadm-init.yaml
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/kube-apiserver:v1.21.0
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/kube-controller-manager:v1.21.0
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/kube-scheduler:v1.21.0
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/kube-proxy:v1.21.0
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/pause:3.4.1
[config/images] Pulled registry.cn-hangzhou.aliyuncs.com/google_containers/etcd:3.4.13-0
failed to pull image "registry.cn-hangzhou.aliyuncs.com/google_containers/coredns/coredns:v1.8.0": output: Trying to pull repository registry.cn-hangzhou.aliyuncs.com/google_containers/coredns/coredns ... 
repository registry.cn-hangzhou.aliyuncs.com/google_containers/coredns/coredns not found: does not exist or no pull access
, error: exit status 1
To see the stack trace of this error execute with --v=5 or higher
```

解决办法: 手动拉取coredns, 然后重新tag

```sh 
docker pull coredns/coredns:1.8.0
docker tag coredns/coredns:1.8.0 registry.cn-hangzhou.aliyuncs.com/google_containers/coredns:v1.8.0
```

### 2.2 初始化master节点

```sh 
kubeadm init --config kubeadm.yml
```

如果执行命令后报错 `/proc/sys/net/bridge/bridge-nf-call-iptables contents are not set to 1`, 执行下面的命令

```sh
echo 1 > /proc/sys/net/bridge/bridge-nf-call-iptables
```

**命令执行完毕后, 控制台输出的最后一行会有一条`kubeadm join`的命令, 用于worker节点加入集群, 复制保存下来, 后面在worker节点上**
```sh
kubeadm join 192.168.58.128:6443 --token abcdef.0123456789abcdef \
	--discovery-token-ca-cert-hash sha256:b1b5df812dbe8d49d6a3aa3ae077bcc11184042f96b3b7e38cb6c9f999389b6f
```

同时控制台会提示执行以下命令, 直接复制执行即可 

```sh 
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

现在查看节点状态, 是NotReady状态
```sh
[root@node1 opt]# kubectl get nodes
NAME    STATUS   ROLES                  AGE   VERSION
node1   NotReady control-plane,master   80m   v1.21.1
```
这是因为网络还没有配置好. 执行第三步

### 2.3 配置网络

```sh
wget https://docs.projectcalico.org/v3.8/manifests/calico.yaml
```
修改calico.yaml中的IP为192.168.0.0/16地方, 改为10.96.0.0/16, 要与kubeadm.yml中的serviceSubnet的值一样

```yml
#### 搜索CALICO_IPV4POOL_CIDR然后修改这一处
- name: CALICO_IPV4POOL_CIDR
  value: "10.96.0.0/16"
####
```

部署calico
```sh
kubectl apply -f calico.yaml
```
部署完成后再查看节点状态已经是Ready状态

## 3. 添加worker节点

两台worker机器分别执行一遍第一大步骤准备工作

然后两台worker机器分别执行2.2步骤里边的`kubeadm join`命令, 至此集群安装完毕

## 4. 安装dashboard

在master节点执行以下命令

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.2.0/aio/deploy/recommended.yaml
grep 'client-certificate-data' ~/.kube/config | head -n 1 | awk '{print $2}' | base64 -d >> kubecfg.crt
grep 'client-key-data' ~/.kube/config | head -n 1 | awk '{print $2}' | base64 -d >> kubecfg.key
openssl pkcs12 -export -clcerts -inkey kubecfg.key -in kubecfg.crt -out kubecfg.p12 -name "kubernetes-client"
```

第三条命令会提示输入密码, 直接回车跳过即可

将生成后的kubecfg.p12文件复制到本机上, 双击导入. 

然后访问[https://192.168.58.128:6443/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#/login.](https://192.168.58.128:6443/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#/login) 

选择token, token在master节点机器上获取

```sh
[root@node1 opt]# kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep admin-user | awk '{print $1}')
Name:         admin-user-token-p5jpl
Namespace:    kube-system
Labels:       <none>
Annotations:  kubernetes.io/service-account.name: admin-user
              kubernetes.io/service-account.uid: d0d5a1d4-6cfb-4296-bc54-dd14987eb89a

Type:  kubernetes.io/service-account-token

Data
====
token:      eyJhbGciOiJSUzI1NiIsImtpZCI6Ik9BSHZYSUVLcnlmMGUzUG9rcDJOZlV5LWlJSEtLaXpQUVJLRjdCQjQ4d3cifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJhZG1pbi11c2VyLXRva2VuLXA1anBsIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZXJ2aWNlLWFjY291bnQubmFtZSI6ImFkbWluLXVzZXIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiJkMGQ1YTFkNC02Y2ZiLTQyOTYtYmM1NC1kZDE0OTg3ZWI4OWEiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6a3ViZS1zeXN0ZW06YWRtaW4tdXNlciJ9.n1Z7zDBQWbQkT-55AZ_ZNnd8ZxHfjsUfUvavhSBN4sbaXU5vpNh1oMMhjL8AmuYfFwmpe6k0NFXwrc0z7bee2q1YwhA7s11QgpxGa2UFnaN0VyU3E3uF4lPhCkBZwTiNFG2qf54bUaTqFBF_h0UGSbz5LFn3g2pfzWr3v742CxjvSrMO9CGVFsKgEI7KzjU38Iaugb5lXOf3DaBrVJRJXPdVXdFqX4BOfjR4QNr3pzsDZ303EFFEfPaM-L_6eJHwZajg7UM3_ciDOGtYO4uigtNwqFmJAcH_oAYMzuEvrTIXhfNIJjoricGA2hslQn5MTjvFF0DPYD6qIYylxNACuw
ca.crt:     1066 bytes
namespace:  11 bytes
```

![k8s-dashboard](http://image.ytg2097.com/k8s-dashboard.png)
