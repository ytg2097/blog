---
prev: ./gitlab-ci
sidebar: auto
---

# 从零开始搭建一条jenkins自动化部署流水线

## 0. 前言

本次流水线搭建目标实现:   代码检查-代码打包-部署 三步自动化. 

## 1. 环境搭建

- 服务器: 一台centos7.8虚拟机, IP: 192.168.58.132

  > 本地调试用, 一台就够, 资源充足可以多台

- 环境: `jdk1.8`, `maven3.5.2`, `jenkins2.289.1`, `sonarqube8.2`, `docker`, `docker-copmpose`

### 1.1 安装jdk

```shell
yum install -y java-1.8.0-openjdk-devel.x86_64
java -version
```

### 1.2 安装maven

```shell
wget http://repos.fedorapeople.org... -O /etc/yum.repos.d/epel-apache-maven.repo
wget https://repos.fedorapeople.org/repos/dchen/apache-maven/epel-apache-maven.repo -O /etc/yum.repos.d/epel-apache-maven.repo
yum -y install apache-maven
mvn -v
```

### 1.3 安装git

```shell
yum install git
git
```

### 1.4 安装jenkins

这里直接使用war启动jenkins , 可以使用`java -jar`命令, 也可以使用tomcat启动. 这次我用的是tomcat

> jenkins.war[下载地址](https://get.jenkins.io/war-stable/2.289.2/jenkins.war)

启动后访问[http://192.168.58.132:8080/jenkins](http://192.168.58.132:8080/jenkins)

插件直接安装jenkins建议安装的插件, 如果有安装失败就重启jenkins几次.

默认密码在/var/jenkins_home/secrets/initialAdminPassword,  直接cat获取

### 1.5 安装sonarqube

先安装docker和docker-compose

```shell
yum install docker	
systemctl enable docker && systemctl start docker
curl -L https://download.fastgit.org/docker/compose/releases/download/1.27.4/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
docker version
docker ps
docker-compose -v
```

再启动sonarqube

```yaml
version: "3.7"

services:
  sonarqube:
    image: sonarqube:8.2-community
    depends_on:
      - db
    ports:
      - "9000:9000"
    networks:
      - sonarnet
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
      - sonarqube_temp:/opt/sonarqube/temp
  db:
    image: postgres
    networks:
      - sonarnet
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
    volumes:
      - postgresql:/var/lib/postgresql
      - postgresql_data:/var/lib/postgresql/data
networks:
  sonarnet:
    driver: bridge
     
volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  sonarqube_temp:
  postgresql:
  postgresql_data:
```

```shell
docker-compose up -d
```

> 如果启动几秒后发现sonarqube报错: ` max virtual memory areas vm.max_map_count [65530] is too low, increase to at least `执行以下命令然后重启容器
>
> ```shell
> sysctl -w vm.max_map_count=262144
> ```

#### 汉化sonarqube

先下载汉化包插件[点我获取](https://image.ytg2097.com/sonar-l10n-zh-plugin-1.16.jar)

查找sonarqube插件的挂载路径, docker默认卷存放位置在/var/lib/docker/volumes/下, 如果按照上述安装步骤一直进行的话, sonarqube容器的插件包路径应该在宿主机的`/var/lib/docker/volumes/sonar_sonarqube_extensions/_data/plugins`下, 将下载好的jar放着这里

![image-20210701170352931](http://image.ytg2097.com/img/image-20210701170352931.png)

然后重启再次访问[http://192.168.58.132/9000](http://192.168.58.132/9000), 可以看到汉化成功

## 2.配置jenkins 

### 2.1 下载插件

进入插件[搜索页面](http://192.168.58.132:8080/jenkins/pluginManager/available), 分别搜索gitee, sonarqube scanner, Config File Provider, 然后安装

### 2.2 新增maven settings文件

进入[配置文件管理页面](http://192.168.58.132:8080/jenkins/configfiles/selectProvider), 选择Maven settings.xml, 然后submit, 在编辑页面里的content框中粘贴进去你的settings.xml配置然后submit

### 2.3 全局配置 

进入[全局工具配置页面](http://192.168.58.132:8080/jenkins/configureTools/)

#### 2.3.1 配置java

![image-20210701172410009](http://image.ytg2097.com/img/image-20210701172410009.png)

#### 2.3.2 配置git

git直接默认配置就好

![image-20210701172526943](http://image.ytg2097.com/img/image-20210701172526943.png)

#### 2.3.3 配置sonarqube

选择自动安装 版本选择4.0

![image-20210701172632014](http://image.ytg2097.com/img/image-20210701172632014.png)

去sonarqube生成一个token

![image-20210701173002630](http://image.ytg2097.com/img/image-20210701173002630.png)

在jenkins配置sonarqube的token

![image-20210701173142754](http://image.ytg2097.com/img/image-20210701173142754.png)

#### 2.3.4 配置maven 

![image-20210701172734324](http://image.ytg2097.com/img/image-20210701172734324.png)

进入系统配置页面[http://192.168.58.132:8080/jenkins/configure](http://192.168.58.132:8080/jenkins/configure)

### 2.4 系统配置

#### 2.4.1配置sonarqube

![image-20210702105600086](http://image.ytg2097.com/img/image-20210702105600086.png)

token选择2.3.3中配置的token

#### 2.4.2配置gitee

![image-20210702105813187](http://image.ytg2097.com/img/image-20210702105813187.png)

![image-20210702105724228](http://image.ytg2097.com/img/image-20210702105724228.png)

配置令牌之后在job中不能选择使用, 还是需要gitee的账号密码来验证,   好像这个gitee APIV5 token没有任何作用,  这一点有待验证

## 3.测试Job

新建一个任务, 选择free style项目

> demo项目地址[https://gitee.com/ytg2097/gitee-ci.git](https://gitee.com/ytg2097/gitee-ci.git)

### 3.1 General

![image-20210702110423395](http://image.ytg2097.com/img/image-20210702110423395.png)

### 3.2 源码管理

gitee链接选择[2.4.2](####2.4.2配置gitee)中配置的gitee地址

源码管理中Repository URL填写你的git项目地址;  Credentials添加一个全局的username类型凭证, 填写git账号密码

![image-20210702111208008](http://image.ytg2097.com/img/image-20210702111208008.png)

![image-20210702111314695](http://image.ytg2097.com/img/image-20210702111314695.png)

### 3.3 构建环境

构建环境中选择之前配置的maven settings文件

![image-20210702111418234](http://image.ytg2097.com/img/image-20210702111418234.png)

### 3.4 构建

构建步骤中新增三个步骤: shell  -  SonarqubeScanner - shell.  三个步骤顺序不能错, 因为Sonnar需要扫描classes目录, 如果没有在sonar扫描之前进行maven打包操作的话会报如下错误

![image-20210702153858954](http://image.ytg2097.com/img/image-20210702153858954.png)

#### 3.4.1 maven 打包命令

```shell
mvn clean install -Dmaven.test.skip=true
```

![image-20210702154106607](http://image.ytg2097.com/img/image-20210702154106607.png)

#### 3.4.2 sonarqube scanner

sonar scanner步骤中的Analysis properties根据实际情况填写以下内容, 其他内容不用填, 默认就可以

![image-20210702154307169](http://image.ytg2097.com/img/image-20210702154307169.png)

```properties
sonar.projectKey=ci-test.cn    
sonar.projectName=ci-test      
sonar.projectVersion=1.0
sonar.sources=src
sonar.java.binaries=target/classes
sonar.language=java
```

#### 3.4.3  启动jar

最后一步启动jar , 在shell步骤中根据需求填写shell命令就可以, 这里直接执行项目中内置的sh

![image-20210702154351765](http://image.ytg2097.com/img/image-20210702154351765.png)

```shell
#!/bin/sh
chmod 755 start.sh
chmod 755 stop.sh
./stop.sh
echo "先停止"
./start.sh
echo "后启动"
```

全部配置完成后保存然后执行一下试试

![image-20210702154658738](http://image.ytg2097.com/img/image-20210702154658738.png)

浏览器访问测试

![image-20210702154734434](http://image.ytg2097.com/img/image-20210702154734434.png)

去sonar看一下扫描结果

![image-20210702112427317](http://image.ytg2097.com/img/image-20210702112427317.png)

## 4. 后语

后面会再更新一篇云服务器环境搭建, 以及容器应用的自动化部署

