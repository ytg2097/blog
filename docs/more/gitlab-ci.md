---
prev: ./uml
sidebar: auto
---

# DevOps, CI/CD, Gitlab-CI

DevOps = Development + Operations. 他是一种方法论, 是一组过程, 方法与系统的统称, 用于促进应用开发, 运维, 测试部门之间的沟通协作与整合. 用于打破传统开发与运营之间的壁垒.

DevOps通过自动化的软件交付于架构变更的流程, 使得构建, 测试, 发布软件能够更加的快捷, 频繁和可靠. 具体来说就是在软件的交付与部署过程中提高沟通与协作的效率. 旨在更快更可靠的发布高质量软件.

也就是说, DevOps是一组过程和方法的统称, 而不特指某一个特定的软件工具或软件工具组合. 各种软件工具用于实现devops的概念方法. 

综上所述. DevOps是一种方法论. 与oop, ddd类似, 是一种理论或过程的抽象. 

既然提到抽象, 那么必定要有实现, ddd有战略与战术设计来实现落地, DevOps则有CI/CD来实现落地. 

## CI/CD  

### CI

CI意为持续集成. Continuous Integration.

持续集成即在我们提交代码之后自动拉取代码, 自动构建, 自动单元测试. 他的目的是确保最新提交的更改是没有问题的, 能够集成到代码主线当中去.

### CD

CD可以理解为两部分: 持续交付Continuous Delivery和持续部署Continuous Deployment. 执行CD的前提为CI完成.  

- 持续交付

在完成CI之后, 持续交付自动将已经验证通过的代码发布到代码仓库中. 持续交付的目标是拥有一个可以随时部署到生产环境的代码仓库或者分支. 

![continuous-delivery](http://image.ytg2097.com/c-delivery.png)

- 持续部署

CI/CD的最终阶段为持续部署. 他作为持续交付的延伸, 持续部署可以自动将应用发布到生产环境. 

![continuous-deployment](http://image.ytg2097.com/c-deployment.png)

他与持续交付的区别是, 持续交付不是指每一个改动都要立刻部署到生产环境中, 而是指任何的代码修改都可以在任何时候实施部署. 

持续交付是一种能力, 而持续部署则是一种方式. 

## Gitlab-CI

要实现自动化的持续集成, 持续交付, 持续部署. 业内有很多的工具可选. 每种工具都有自己擅长的领域. 我们需要根据自己的实际需求做选型. 本篇文章中使用Gitlab-ci来实现CI/CD.

之所以没有选用Jenkins, 是因为Gitlab-CI在同样拥有jenkins中我们所需要的功能的基础上作为Gitlab中内置的持续集成工具, 不需要我们去安装各种插件来完成CI/CD, 可以更方便的控制git仓库. 同时更好的集成docker. 

下面图文演示从0开始使用docker搭建一套Gitlab-CI环境以及使用Gitlab-CI来实现spring-boot项目的CI/CD.

### 0. 快速入门Gitlab-CI

Gitlab-CI主要通过`.gitlab-ci.yml`配置文件来完成CI/CD. `.gitlab-ci.yml`文件放置在git仓库的根目录, 与`.gitignore`同级. 
这个文件中我们可以定义要运行的脚本, 也可以创建一个CI/CD的pipeline, pipeline由一个或多个stage组成. 每个stage中可以包含一个或多个并行运行的任务. 
这些任务由Gitlab-Runner来执行. 

Gitlab-CI中的一些概念

- **Pipeline** 

一个Pipeline表示一个构建任务, 其中可以包含多个步骤, 如自动构建, 自动测试等. |

- **Stage**
 
Stage表示构建任务中的一个阶段, stage按顺序执行|

- **Job**

Job表示某个Stage中要执行的任务, 一个Stage中可以有多个Job, 相同Stage中的Job会并行执行. 并且只有所有Job都成功后, 当前Stage才算通过|

- **Runner**
 
 Runner与Gitlab-CI之间可以理解为线程与线程池的关系, 每个Runner都会注册到Gitlab-CI中. 在注册时, Runner会表明自己服务于哪个代码仓库. 当对应的仓库发生变化时, 
 Gitlab-CI就会通知Runner去执行对应的任务.  

> 官方文档: [https://docs.gitlab.com/ee/ci/](https://docs.gitlab.com/ee/ci/)

### 1. 部署Gitlab-CI环境

这里笔者使用的系统为centos7, docker版本为19.03.11. 

使用docker-compose来快速启动gitlab与gitlab-runner. 
```yml
version: '3.7'

services:
  gitlab:
    image: gitlab/gitlab-ce
    container_name: gitlab
    hostname: gitlab
    ports:                              
      - "2222:22"
      - "8080:80"
      - "8443:443"
    networks:
      - devops
    volumes:
      - gitlab-config:/etc/gitlab
      - gitlab-logs:/var/log/gitlab
      - gitlab-data:/var/opt/gitlab
    logging:
      driver: "json-file"
      options:
        max-size: "200k"
        max-file: "10"
  gitlab-runner:
    image: gitlab/gitlab-runner
    container_name: gitlab-runner
    depends_on:
      - gitlab
    networks:
      - devops
    volumes:
      - gitlab-runner-config:/etc/gitlab-runner
      - /var/run/docker.sock:/var/run/docker.sock 

networks:
  devops:
    name: devops
    external: true

volumes:
  gitlab-config:
    name: gitlab-config
  gitlab-logs:
    name: gitlab-logs
  gitlab-data:
    name: gitlab-data
  gitlab-runner-config:
    name: gitlab-runner-config
```

docker-compose命令启动后, 发现生成的gitlab仓库的clone地址是按照容器的hostname生成的: `http://gitlab/root/demo.git`, 

我们可以通过修改gitlab的配置文件gitlab.rb来修改为固定的url访问地址. 
在docker-compose.yml中已经配置了将gitlab的config文件挂载到gitlab-config卷中. 我们进入到gitlab-config卷的宿主机目录, 分别修改gitlab.rb与gitlab.yml文件. 

- gitlab.rb文件中我们在文件底部增加三个配置
```
external_url 'http://192.168.7.105:8080'
nginx['listen_port'] = 80
gitlab_rails['gitlab_shell_ssh_port'] = 8443#  
```
> gitlab.rb文件位于gitlab-config卷中
- 在gitlab.yml中修改配置
```
## GitLab settings
gitlab:
  ## Web server settings (note: host is the FQDN, do not include http://)
  host: 192.168.7.105
  port: 8080
  https: false
```
> gitlab.yml文件在gitlab-data卷中/gitlab-rails/etc/下

修改后可以看到http clone地址已经修改过来了.

![clone-url](http://image.ytg2097.com/clone-url.png)

### 2. 注册GitlabRunner

先运行如下命令
```bash
docker exec -it gitlab-runner gitlab-runner register 
```

执行命令后会交互式的依次输入git实例地址, runner的token等信息. 
git地址与runner可以在gitlab中项目的settings中找到.

![runner-config](http://image.ytg2097.com/runner-config.png)

```bash

Enter the GitLab instance URL (for example, https://gitlab.com/):
# 输入Gitlab实例地址: 
http://192.168.7.105:8080/

Enter the registration token:
# 输入token
abcdefg 
    
Enter the gitlab-ci description for this runner
# 输入描述
runner
    
Enter the gitlab-ci tags for this runner (comma separated):
# 输入与这个Runner关联的标签, 这个标签可以在.gitlab-ci.yml中用来指定Runner
maven, docker

Enter the executor: ssh, docker+machine, docker-ssh+machine, kubernetes, docker, parallels, virtualbox, docker-ssh, shell:
# 输入Runner的执行器, 我们使用docker镜像, 所以输入docker. 
docker            

Enter the Docker image (eg. ruby:2.1):
# 输入执行器的版本, 这里使用最新的
docker:latest  
```
注册之后可以在gitlab项目的settings/CI/CD/Runners中看到

![registered](http://image.ytg2097.com/gitlab-runner-registed.png)

### 3. 触发GitlabRunner

#### 3.1 新建spring-boot项目并添加一个.gitlab-ci.yml文件.

![gitlabcidemo](http://image.ytg2097.com/gitlab-ci-demo.png) 

#### 3.2 编写.gitlab-ci.yml文件

这里我们需要的CI/CD流水线是当代码提交到master分之后, 自动进行maven打包, 并构造为docker镜像然后启动. 下面是详细配置. 

```yml        
variables:
  DOCKER_DRIVER: overlay2
  #找到了
  # 关闭TLS, 避免出现dind, sock连接不上的问题
  DOCKER_TLS_CERTDIR: ""
  # 提供给的maven打包时使用的参数   不是用maven镜像中的settings  使用我们自己的
  MAVEN_CLI_OPTS: "-s ci_settings.xml --batch-mode"
  TAG: demo:0.1

cache:
  paths:
    - .m2/repository/
    - target/
    
services:
  - docker:19.03.0-dind

stages:
  - package
  - deploy

maven-package:
  image: maven:3.6-jdk-8-alpine
  stage: package
  tags:
    - maven
  script:
    - mvn $MAVEN_CLI_OPTS clean package -Dmaven.test.skip=true
  artifacts:
    paths:
      - target/*.jar

build-master:
  image: docker:latest
  tags:
    - docker
  stage: deploy
  script:
    - docker build -t $TAG .
    - docker rm -f test || true
    - docker run -d --name test -p 5000:5000 $TAG
    - sleep 1000
  only:
    - master
```
> 后面会详细解析.gitlab-ci.yml中个各项配置

上面的`MAVEN_CLI_OPTS`变量中有用到ci_settings.xml文件, 这个maven的settings文件在stage为package的步骤中被指定替换了maven:3.6-jdk-8-alpine中的settings文件. 
在这个文件中我们可以配置maven的镜像加速. 并指定依赖拉取后的存放位置, 这一点尤为重要, 与`cache`参数搭配可以不用每次都去maven仓库重新拉取依赖. ci_settings.xml配置如下.

```xml
<?xml version="1.0" encoding="UTF-8"?>

<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <!--这里与gitlab-ci.yml中的cache参数对应-->
    <localRepository>.m2/repository</localRepository>
    <servers>
        <server>
            <!--身份证唯一标识-->
            <id>devops</id>
            <!--maven私服的帐号-->
            <username>devops</username>
            <!--maven私服的密码-->
            <password>123456</password>
        </server>
    </servers>
    <mirrors>
        <mirror>
            <!--对应server里面的id-->
            <id>devops</id>
            <mirrorOf>central</mirrorOf>
            <name>Nexus Mirror</name>
            <!--配置maven私服的仓库地址-->
            <url>http://192.168.7.105:8082/repository/maven-public</url>
        </mirror>
    </mirrors>
</settings>
```

#### 3.3 修改Dockerfile

```dockerfile
FROM openjdk:8-jdk-alpine
VOLUME: /tmp
COPY  /target/demo-0.0.1-SNAPSHOT.jar app.jar
ENV PORT 5000
EXPOSE $PORT
ENTRYPOINT ["java","-Djava.security.egd=file:/dev/./urandom","-Dserver.port=${PORT}","-jar","/app.jar"]
```

#### 3.4 提交修改
已成功
提交修改后, 整个项目的目录结构如下
![gitlabci-directory](http://image.ytg2097.com/gitlabci-directory.png)

进入gitlab项目的CI/CD页面可以看到, 两个stage已经执行成功

![gitlabci-successful](http://image.ytg2097.com/gitlabci-successful.png)

## gitlab-ci.yml

gitlab-ci.yml需要存放到代码仓库的根目录, 他用于定义编排持续集成的流水线以及定义流水线中每个步骤上的job应该如何工作. 

### image

image关键字用于指定一个任务所使用的docker镜像, 如上文中使用`image: maven:3.6-jdk-8-alpine`使用的是maven的3.6版本镜像. 

::: tip 镜像下载策略
- never: 禁止Runner从Docker Hub中或私服中拉取镜像
- if-not-present: Runner现在本地检测是否有镜像可用, 如果没有再去拉取
- always: 每次都重新拉取镜像, 这也是gitlab-ci的默认策略.

镜像的拉取策略在config.toml中进行配置
::: 

### services

services关键字中指定job中所需的其他Docker镜像, 如上文中引入了`docker:dind`用于打包docker镜像. 我们也可以绑定一个mysql服务或者redis服务用来做单元测试.
```yml
job1: 
    image: java-app 
    services:
        - mysql:5.7
    script: 
        - java -jar app.jar    
```

### before_script, after_script

before_script定义一组在任务开始之前执行的命令, after_script相反.

### stages

stages用于编排一组任务的执行顺序. 我们之前所说的流水线就是一组stage, 流水线的执行顺序由stages中定义的顺序决定

```yml 
stages: 
    - build
    - test
    - deploy
```
如果有多个job的stage相同, 则他们会并行执行. 

### only/except

only/except关键字控制的是任务的触发条件. only/except之下还包含了一些关键字. 如branches, tags等, 可配置的策略有很多种, 具体的可以查看[文档](https://docs.gitlab.com/ee/ci/yaml/#onlyexcept-basic). 它们决定了本次任务的出发条件采用什么策略. 

only关键字是当条件符合定义的策略时就会触发流水线任务的执行. except则是与only相反.

当配置了多个触发条件时, 他们之间的关系是**或**  
### tags

tags决定了使用那个Runner去执行这个任务, 之前我们在向gitlab-ci注册Runner时配置了Runner的Tag属性. 这里的tags指的就是Runner的Tag

```yml
maven-package:
  image: maven:3.5-jdk-8-alpine
  stage: package
  tags:
    # 使用tag为maven的runner去执行任务
    - maven
```
### when

上文提到stages可以控制任务的执行顺序, 只有前一个stage执行成功后才会执行下一个stage. 如果我们需要不论前一个任务是否执行成功都执行后续的任务就可以使用when关键字. 
他有五个选项: 
- on_success: 只有前一个stage成功才会执行. 默认的
- on_failure: 前面的任意一个stage失败就会执行
- always: 无论前面的stage是否成功都执行
- manual: 需要手动执行
- delayed: 延迟执行

```yml 
# 官方示例
stages:
  - build
  - cleanup_build
  - test
  - deploy
  - cleanup

build_job:
  stage: build
  script:
    - make build

# 如果build_job任务失败，则会触发该任务执行
cleanup_build_job:
  stage: cleanup_build
  script:
    - cleanup build when failed
  when: on_failure

test_job:
  stage: test
  script:
    - make test

deploy_job:
  stage: deploy
  script:
    - make deploy
  when: manual

# 总是执行
cleanup_job:
  stage: cleanup
  script:
    - cleanup after jobs
  when: always
```
### cache

cache目录指定需要缓存的文件或文件夹. 主要用于存储任务中的依赖项, 如maven的依赖

cache中指定的是相对路径. 这个相对路径是相对于当前用户以及当前项目的. 也就是默认的路径是`/home/user/youproject`下的


详见https://stackoverflow.com/questions/53953122/gitlab-ci-cache-no-matching-files/54058626
### artifacts

类似于cache关键字, 用于缓存文件和文件夹, 不过这些缓存的文件可以在gitlab的ui下载. 他用于在各个stage之间传递中间构建结果. 他还可以定义过期时间.

### variables

变量分为三种gitlab-ci预定义的变量, gitlab中setting/CI-CD中设置的变量与我们在文件中自定义的变量. 
预定义变量包括CI_COMMIT_BRANCH,CI_COMMIT_MESSAGE等.

> 更多配置参数请查看官方文档: [https://docs.gitlab.com/ee/ci/yaml](https://docs.gitlab.com/ee/ci/yaml) 

> gitlab-ci.yml模版文件: [https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/lib/gitlab/ci/templates](https://gitlab.com/gitlab-org/gitlab-foss/-/blob/master/lib/gitlab/ci/templates)
--- 

以上所有的关键词都是不限层级的, 我们可以理解为整个gitlab-ci.yml的最顶层节点定义的是一组任务, 其中我们可以配置before_script, after_script, stages, services等. 同时在我们定义的每个stage
中, 同样可以配置before_script, after_script, stages, services等. 以面向对象的角度来看他是嵌套引用的. 如下示例

```java 
public class GitlabCIYML{

    List<String> before_script;
    List<String> after_script;
    List<String> services;
    List<String> stages;
    String image;
    String stage;
    ...
    
    List<GitlabCIYML> stage;
}
``` 
