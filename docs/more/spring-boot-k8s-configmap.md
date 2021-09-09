---
sidebar: none
---

# Spring boot应用发布到k8s中并挂载外部配置文件

在项目开发中, 大都会为不同的运行环境编写不同的配置文件, 比如生产环境使用application-prod.yml, 开发环境使用application-dev.yml.

在spring boot 应用部署到k8s之前, 配置文件的挂载一般都会在打jar包时包含在内, 或着把配置文件的内容保存在nacos之类的中间件中在启动应用时读取配置.

在应用k8s之后,  配置文件可以在通过ConfigMap资源剥离出来单独部署,  本次记录spring boot框架的java应用结合k8s的ConfigMap的实现外部配置文件挂载的一次实践.

- **application.yml位置与读取优先级**

spring boot会默认读取jar包同级目录下的application.yml文件, 还会读取jar包同级目录下的config/application.yml文件.

```bash
|-- application.yml
|-- config
|   `-- application.yml
`-- springboot-docker-demo-0.0.3-SNAPSHOT.jar
```

在如上的目录层级结构中, spring boot 读取配置文件的优先级是**config/application.yml  > application.yml > jar包内application.yml.**

- demo测试

```java
@RestController
@SpringBootApplication
public class SpringbootDockerDemoApplication {

    public static void main(String[] args) {

        String path = System.getProperty("user.dir");
        System.out.println("---------- workdir: " + path + " ----------");
        boolean externalProfile = new File(path + File.separator + "application.yml").exists();
        boolean configDirProfile = new File(path + File.separator + "config" + File.separator + "application.yml").exists();
        if (configDirProfile){
            System.out.println("---- 将使用config/下的application.yml");
        }else if (externalProfile){
            System.out.println("---- 将使用jar的同级目录中的application.yml");
        }else {
            System.out.println("---- 将使用jar中的application.yml");
        }
        SpringApplication.run(SpringbootDockerDemoApplication.class, args);
    }

    @Value("${yourName}")
    private String yourName;

    @Value("${myName}")
    private String myName;

    @GetMapping
    public String sayHello(){

        return myName.concat("  hello hello ").concat(yourName);
    }

}
```

此时src/main/resources/application.yml中文件内容

```yaml
yourName: 嘿嘿
myName: ytg2097
```

执行mvn package之后, 在target目录中清理掉除jar包之外的文件, 然后在target目录中加入application.yml和config/application.yml

```bash
E:/ytg2097/springboot-docker-demo/target
|-- application.yml
|-- config
|   `-- application.yml
`-- springboot-docker-demo-0.0.3-SNAPSHOT.jar
```

application.yml内容

```yaml
yourName: 哈哈
myName: ytg2097
```

config/application.yml内容

```yaml
yourName: 吼吼
myName: ytg2097
```

启动项目后访问localhost:8080返回:  `ytg2097  hello  hello  吼吼`. 删除config/application.yml后再次访问返回: `ytg2097  hello  hello  哈哈`.  再删除application.yml后返回:  `ytg2097  hello  hello  嘿嘿`.

- **发布到k8s**

发布到已经知道, spring boot可以读取jar之外的主机路径下的文件,  现在我们结合k8s的`volumeMounts`, `ConfigMap`实现配置文件挂载到pod的容器中.

1. 打镜像

   打镜像比较简单, 我使用的dockerfile-maven-plugin插件打包的, demo代码现在已经上传到[github](https://github.com/ytg2097/springboot-docker-demo)中

2. 编写k8s.yml

   ```yaml
   kind: ConfigMap
   apiVersion: v1
   metadata:
     name: spring-boot-demo-config
   data:
     application.yml: |-
       yourName: 哈哈
       myName: 阳光大男孩
   ---
   kind: Deployment
   apiVersion: apps/v1
   metadata:
     name: spring-boot-demo
     labels:
       ytg2097.com/java: spring-boot-demo
   spec:
     replicas: 1
     selector:
       matchLabels:
         ytg2097.com/java: spring-boot-demo
     template:
       metadata:
         name: spring-boot-demo
         labels:
           ytg2097.com/java: spring-boot-demo
       spec:
         volumes:
           - name: configmap-demo
             configMap:
               name: spring-boot-demo-config
               items:
                 - key: application.yml
                   path: application.yml
         containers:
           - name: spring-boot-demo
             image: 'ytg2097/springboot-docker-demo:0.0.3-SNAPSHOT'
             resources:
               limits:
                 cpu: 128m
                 memory: '256Mi'
               requests:
                 cpu: 64m
                 memory: '256Mi'
             volumeMounts:
               - name: configmap-demo
                 mountPath: /config
   ---
   kind: Service
   apiVersion: v1
   metadata:
     name: spring-boot-demo-nodeport
     labels:
       ytg2097.com/java: spring-boot-demo
   spec:
     ports:
       - name: spring-boot-demo-nodeport-8080
         protocol: TCP
         port: 8080
         targetPort: 8080
         nodePort: 35015
     selector:
       ytg2097.com/java: spring-boot-demo
     type: NodePort
   ```

   volumeMounts中引用了volume对象configmap-demo. configmap-demo中有引用了ConfigMap对象作为volume挂载, 并且在items中声明了使用key为application.yml的value作为文件挂载, 并且文件路径为application.yml, 结合volumeMounts中的mountPath: /config, 最后ConfigMap对象spring-boot-demo-config中的key为application.yml的value被作为文件挂载到了容器的/config/application.yml.

   > 小知识点: 如果volumeMounts使用subPath来挂载, k8s是不会做热更新的



将yml文件apply到k8s中后测试

   ```bash
   $ curl 192.168.58.136:35015
   阳光大男孩  hello hello  哈哈
   ```

> 后续再研究一下有什么办法可以做到spring cloud config那样的热更新配置文件

