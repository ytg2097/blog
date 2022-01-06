---
prev: ./optimization
sidebar: auto
---
# k8s部署mysql的主从复制集群

目标: 在k8s集群中部署一套mysql集群

## 调研

### Mysql集群架构
这里主要列出两种业内相对比较常见的mysql集群架构
#### Replication

Replication是mysql自带功能. 通过binlog回放实现对主数据库的异步复制.

![mysql-replication](http://image.ytg2097.com/img/24020646_1322489141gf66.jpg)

master在执行一条sql时, 会把这条sql保存到binlog中. slave中会单独有一条IO线程打开一个到master的连接, 然后读取master的binlog.  当master中的binlog有新数据(sql记录)时, slave的IO线程就会把这个新数据读取到slave的中继日志relaylog里边.  同时slave里还有一条sql线程监听着relaylog, relaylog有变化时, sql线程就会读取这个变化回放一遍.

Replication主要用作多点备份的读写分离模式, master节点提供写, 多个slave节点通过负载均衡提供读.

> mysql的Replication中, slave节点也可以作为master节点, 被其他slave节点复制. 同时还可以做多主一从, 互为主从

**Replication缺点**:

1. slave的回放总是会晚于master的写入. 因此会出现滞后
2. 要求主从节点之间的网络要够好, 否则会出现严重滞后.
3. 相对于k8s来说, pod朝生夕死, 如果master节点的pod挂了, 会导致不能提供写服务

#### NDB Cluster

NDB Cluster是mysql官方提供的集群方案.

NDB Cluster是一种无共享系统中(shared nothing system)实现内存数据库集群的技术. 他是真正的分布式的架构, Replication只是高可用mysql架构的一种.

> shared nothing 指系统中的每个单元都有自己的CPU/内存/硬盘, 不存在共享资源. shared nothing架构中的每一个节点都是独立的. 跨节点的数据访问通过网络通讯完成.
>
> 与shared nothing相对的是shared disk, 每个节点有自己的CPU, 内存, 但是共享存储.

![mysql-cluster](http://image.ytg2097.com/img/cluster-components-1.png)

NDB Cluster中有三种节点: 管理节点, 数据节点和sql节点. 管理节点负责管理数据节点和sql节点和集群的配置文件和日志文件, 以及监控和控制其他节点. 数据节点使用基于内存的存储引擎NDB引擎来存放数据, 数据保存到一个数据节点后会自动复制到其他数据节点. sql节点用于访问数据节点. 节点中运行的是mysqld

NDB Cluster没有读写之分, 他的可用性相比较与主从复制更高.  NDB引擎的伸缩性可更好.

**NDB Cluster缺点**:

1. NDB存储引擎的事务隔离级别只支持读已提交(不过前提也是看数据库所服务的客户端的业务场景)
2. 对网络要求高. 所有数据访问至少经过两个节点才能完成
3. 对内存要求大.
4. 复杂性更高

### 取舍

最终还是选择主从复制模式. 原因如下:

NDB Cluster的复杂性过高, 没有DBA的情况下尽量不要尝试这种高难度操作(这一点是关键)

虽然主从复制的数据滞后问题现在业内已经有了很多解决方案,所以综合考虑还是使用主从复制架构.

## 实施

k8s相关概念和集群搭建参考我之前的笔记

https://ytg2097.com/container/k8s-cluster.html

https://ytg2097.com/container/k8s.html

### StorageClass

集群搭建完成后是没有默认的storageClass的, 所以在创建完storageClass之后再把它设置为默认的storageClass对象. 默认的 StorageClass 以后将被用于动态的为没有特定存储类需求的 PersistentVolumeClaims 配置存储.

因为Local类型的provisioner是不支持动态制备的, 这里选择nfs作为k8s的默认存储.  nfs的部署不在赘述, 网上有很多资料. 这里只列出nfs的provisioner的定义
#### nfs-client.yml

```yaml
kind: Deployment
apiVersion: apps/v1
metadata:
  name: nfs-client-provisioner
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: nfs-client-provisioner
  template:
    metadata:
      labels:
        app: nfs-client-provisioner
    spec:
      serviceAccountName: nfs-client-provisioner
      containers:
        - name: nfs-client-provisioner
          image: easzlab/nfs-subdir-external-provisioner:v4.0.1
          volumeMounts:
            - name: nfs-client-root
              mountPath: /persistentvolumes
          env:
            - name: PROVISIONER_NAME
              # PROVISIONER_NAME的值会在storageClass中用到
              value: fuseim.pri/ifs
            - name: NFS_SERVER
              #  这里填写你的nfs服务器ip
              value: 192.168.58.139
            - name: NFS_PATH
              value: /data/k8s
      volumes:
        - name: nfs-client-root
          nfs:
          	#  这里填写你的nfs服务器ip
            server: 192.168.58.139
            path: /data/k8s
```

#### nfs-client-sa.yaml

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nfs-client-provisioner

---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: nfs-client-provisioner-runner
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "update"]
  - apiGroups: ["storage.k8s.io"]
    resources: ["storageclasses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["list", "watch", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["endpoints"]
    verbs: ["create", "delete", "get", "list", "watch", "patch", "update"]

---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: run-nfs-client-provisioner
subjects:
  - kind: ServiceAccount
    name: nfs-client-provisioner
    namespace: default
roleRef:
  kind: ClusterRole
  name: nfs-client-provisioner-runner
  apiGroup: rbac.authorization.k8s.io
```

#### nfs-storage.yml

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-storage
# 填写nfs-client.yml中的  PROVISIONER_NAME
provisioner: fuseim.pri/ifs
```

设置nfs-storage作为k8s集群的默认存储

```bash
kubectl patch storageclass local-storage -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```
看一下已经部署完成了

```bash
[root@node1 ~]# kubectl get sc
NAME                    PROVISIONER                    RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION   AGE
local-storage           kubernetes.io/no-provisioner   Delete          Immediate           false                  4h27m
nfs-storage (default)   fuseim.pri/ifs                 Delete          Immediate           false                  3h
```

---
接下来部署mysql相关

mysql主从集群的部署主要参考k8s官方文档示例, 有一点小坑已经趟过

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mysql
  labels:
    app: mysql
data:
  master.cnf: |
    # 这个配置会被挂在到master节点.
    [mysqld]
    log-bin    
  slave.cnf: |
    # 这个配置会被挂在到slave节点.
    [mysqld]
    super-read-only    
```

### Service

因为mysql是有状态的, 所以使用statefulset去调度mysql的pod, 同时我们是主从架构的, 所以我们需要直接链接到某个pod上面去, 所以先用headlessService为每个pod副本创建一个可预知的DNS主机名.

同时内部约定一个名为mysql-read的sevice为每个pod做读操作的负载均衡. 如果有mysql的写操作可以通过mysql-0.mysql去访问master

````yaml
# Headless service for stable DNS entries of StatefulSet members.
apiVersion: v1
kind: Service
metadata:
  name: mysql
  labels:
    app: mysql
spec:
  ports:
  - name: mysql
    port: 3306
  clusterIP: None
  selector:
    app: mysql
---
# Client service for connecting to any MySQL instance for reads.
# For writes, you must instead connect to the master: mysql-0.mysql.
apiVersion: v1
kind: Service
metadata:
  name: mysql-read
  labels:
    app: mysql
spec:
  ports:
  - name: mysql
    port: 3306
  selector:
    app: mysql
````

### StatefulSet

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  selector:
    matchLabels:
      # 适用于所有label包括app=mysql的pod
      app: mysql
  serviceName: mysql
  replicas: 3

  #  定义pod
  template:
    metadata:
      labels:
        app: mysql
    spec:
      # 在init容器中为pod中的mysql容器做初始化工作
      initContainers:
        # init-mysql容器会分配pod的角色是master还是slave, 然后生成配置文件
        - name: init-mysql
          image: mysql:5.7
          command:
            - bash
            - "-c"
            - |
              set -ex
              # 生成server-id
              [[ `hostname` =~ -([0-9]+)$ ]] || exit 1
              ordinal=${BASH_REMATCH[1]}
              echo [mysqld] > /mnt/conf.d/server-id.cnf
              # 写入server-id
              echo server-id=$((100 + $ordinal)) >> /mnt/conf.d/server-id.cnf
              # server-id尾号为0作为master, 否则作为slave
              # 这里cp到pod中的cnf会与server-id.cnf一块被mysql.cnf  include进去
              # 这里指定了序号为0的pod会作为master节点提供写, 其他pod作为slave节点提供读
              if [[ $ordinal -eq 0 ]]; then
                cp /mnt/config-map/master.cnf /mnt/conf.d/
              else
                cp /mnt/config-map/slave.cnf /mnt/conf.d/
              fi
          volumeMounts:
            # 将conf临时卷挂载到了pod的/mnt/conf.d路径下
            - name: conf
              mountPath: /mnt/conf.d
            # 这里把ConfigMap中的配置怪哉到了pod的/mnt/config-map路径下
            - name: config-map
              mountPath: /mnt/config-map
        # 这一个init容器会正在pod启动时假定之前已经存在数据, 并将之前的数据复制过来, 以确保新pod中有数据可以提供使用
        - name: clone-mysql
          # xtrabackup是一个开源工具, 用于克隆mysql的数据
          image: ist0ne/xtrabackup:latest
          command:
            - bash
            - "-c"
            - |
              set -ex
              # Skip the clone if data already exists.
              [[ -d /var/lib/mysql/mysql ]] && exit 0
              # Skip the clone on master (ordinal index 0).
              [[ `hostname` =~ -([0-9]+)$ ]] || exit 1
              ordinal=${BASH_REMATCH[1]}
              [[ $ordinal -eq 0 ]] && exit 0
              # Clone data from previous peer.
              ncat --recv-only mysql-$(($ordinal-1)).mysql 3307 | xbstream -x -C /var/lib/mysql
              # Prepare the backup.
              xtrabackup --prepare --target-dir=/var/lib/mysql
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
              subPath: mysql
            - name: conf
              mountPath: /etc/mysql/conf.d
      containers:
        # 实际运行mysqld服务的mysql容器
        - name: mysql
          image: mysql:5.7
          env:
            - name: MYSQL_ROOT_PASSWORD
              value: "123456"
          ports:
            - name: mysql
              containerPort: 3306
          volumeMounts:
            # 将data卷的mysql目录挂在到容器的/var/lib/mysql
            - name: data
              mountPath: /var/lib/mysql
              subPath: mysql
            - name: conf
              mountPath: /etc/mysql/conf.d
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
          # 启动存活探针, 如果失败会重启pod
          livenessProbe:
            exec:
              command: ["mysqladmin", "ping"]
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
          # 启动就绪探针确保容器的运行正常, 如果有失败会将pod从service关联的endpoint中剔除
          readinessProbe:
            exec:
              # Check we can execute queries over TCP (skip-networking is off).
              command: ["mysql", "-h", "127.0.0.1", "-e", "SELECT 1"]
            initialDelaySeconds: 5
            periodSeconds: 2
            timeoutSeconds: 1
        # init结束后还会在启动一个xtrabackup容器作为mysqld容器的sidecar运行
        - name: xtrabackup
          image: ist0ne/xtrabackup:latest
          ports:
            - name: xtrabackup
              containerPort: 3307
          command:
            - bash
            - "-c"
            - |
              set -ex
              cd /var/lib/mysql
              # 他会在启动时查看之前是否有数据克隆文件存在, 如果有那就去其他从节点复制数据, 如果没有就去主节点复制数据
              # Determine binlog position of cloned data, if any.
              if [[ -f xtrabackup_slave_info && "x$(<xtrabackup_slave_info)" != "x" ]]; then
                # XtraBackup already generated a partial "CHANGE MASTER TO" query
                # because we're cloning from an existing slave. (Need to remove the tailing semicolon!)
                cat xtrabackup_slave_info | sed -E 's/;$//g' > change_master_to.sql.in
                # Ignore xtrabackup_binlog_info in this case (it's useless).
                rm -f xtrabackup_slave_info xtrabackup_binlog_info
              elif [[ -f xtrabackup_binlog_info ]]; then
                # We're cloning directly from master. Parse binlog position.
                [[ `cat xtrabackup_binlog_info` =~ ^(.*?)[[:space:]]+(.*?)$ ]] || exit 1
                rm -f xtrabackup_binlog_info xtrabackup_slave_info
                echo "CHANGE MASTER TO MASTER_LOG_FILE='${BASH_REMATCH[1]}',\
                      MASTER_LOG_POS=${BASH_REMATCH[2]}" > change_master_to.sql.in
              fi

              # Check if we need to complete a clone by starting replication.
              if [[ -f change_master_to.sql.in ]]; then
                echo "Waiting for mysqld to be ready (accepting connections)"
                until mysql -h 127.0.0.1 -e "SELECT 1"; do sleep 1; done

                echo "Initializing replication from clone position"
                mysql -h 127.0.0.1 \
                      -e "$(<change_master_to.sql.in), \
                              MASTER_HOST='mysql-0.mysql', \
                              MASTER_USER='root', \
                              MASTER_PASSWORD='', \
                              MASTER_CONNECT_RETRY=10; \
                            START SLAVE;" || exit 1
                # In case of container restart, attempt this at-most-once.
                mv change_master_to.sql.in change_master_to.sql.orig
              fi

              # Start a server to send backups when requested by peers.
              exec ncat --listen --keep-open --send-only --max-conns=1 3307 -c \
                "xtrabackup --backup --slave-info --stream=xbstream --host=127.0.0.1 --user=root"
          volumeMounts:
            # 将data卷的mysql目录挂在到容器的/var/lib/mysql
            - name: data
              mountPath: /var/lib/mysql
              subPath: mysql
            - name: conf
              mountPath: /etc/mysql/conf.d
          resources:
            requests:
              cpu: 100m
              memory: 100Mi
      volumes:
        - name: conf
          # pod在节点上被移除时, emptyDir会同时被删除
          # emptyDir一般被用作缓存目录,  这里用在config
          emptyDir: {}
        - name: config-map
          # ConfigMap对象中存储的数据可以被configMap类型的卷引用, 然后被Pod中运行的容器使用
          # 这里引用了前面定义了名称为mysql的ConfigMap对象
          configMap:
            name: mysql

  volumeClaimTemplates:
    # 这里面定义的是对PVC的模板, 这里没有单独为mysql创建pvc, 而是动态创建的
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        # 如果没有配置默认的storageClass的话, 需要指定storageClassName
        # storageClassName: your-sc-name
        resources:
          requests:
            storage: 10Gi
```

---

### 验证

将这几个manifest文件部署到k8s中后查看运行是否正常.

```bash
[root@node1 ~]# kubectl get pods
NAME                                      READY   STATUS    RESTARTS   AGE
mysql-0                                   2/2     Running   0          74m
mysql-1                                   2/2     Running   1          73m
mysql-2                                   2/2     Running   0          58m
```

测试数据插入查询:

1. 向master节点插入数据

```bash
kubectl run mysql-client --image=mysql:5.7 -i --rm --restart=Never --\
  mysql -h mysql-0.mysql <<EOF
CREATE DATABASE test;
CREATE TABLE test.messages (message VARCHAR(250));
INSERT INTO test.messages VALUES ('hello');
EOF
```

2. 使用mysql-read查询数据

```bash
[root@node1 ~]# kubectl run mysql-client --image=mysql:5.7 -i -t --rm --restart=Never --\
>   mysql -h mysql-read -e "SELECT * FROM test.messages"
+---------+
| message |
+---------+
| hello   |
+---------+
pod "mysql-client" deleted
```

---

到此为止, mysql集群部署完成, 当前环境如下

- k8s1.21一主两从
- mysql5.7一主两从
- nfs一个

**本次部署的mysql集群目前仅做技术调研和测试使用, 若要进一步用于生产环境还需要做进一步论证和调整**
