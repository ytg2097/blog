---
prev: ./nginx-root-alias
sidebar: none
---
# 使用h2数据库支持单元测试

在实践测试驱动开发时候会有一个比较麻烦的事情: 测试用例中包含数据库操作

## mysql & junit

>  单测一个简单的service方法

```java
    @Test
    void createTeacher() {

        // do
        TeacherRegisterRequest registerRequest = new TeacherRegisterRequest();
        registerRequest.setEmail("ytg2097@163.com");
        registerRequest.setName("杨同港");
        
        String teacherId = teacherService.createTeacher(registerRequest);

        // when
        assertNotEquals(teacherId,null);

        // then
        teacherService.deleteTeacher(teacherId);
    }
```



在使用mysql时, 单元测试中除了要编写对目标代码的测试代码之外, 还需要在测试代码之后再编写一段手动回滚之前操作的代码, 这是非常麻烦的. 当单元测试变多的时候, 这些附加代码也会带来一些工作量.

## h2 & junit

H2数据库是一个支持嵌入式和服务器模式的开源的天生支持JDBC的内存数据库. 当把它嵌入到我们的java应用时, 应用启动h2数据库会随之创建, 应用终止h2数据库也会随之销毁, 这就很好的解决了我们的痛点.

下面是在spring boot的项目中集成h2的代码

> pom.xml

```xml
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <version>1.4.200</version>
        </dependency>
```

> application-test.yml

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    # h2 jdbc driver
    driverClassName: org.h2.Driver
    # jdbc:h2:mem:test  设置为内存模式,应用关闭后销毁 也可以设置保存到文件中 jdbc:h2:file:/data/h2-data
    # DB_CLOSE_DELAY=-1  没有连接时会自动销毁数据库, -1表示关闭这个设置
    # MODE=MySQL 兼容mysql
    url: jdbc:h2:mem:test;DB_CLOSE_DELAY=-1;MODE=MySQL
    username:
    password:
    # 每次启动都会运行schema_h2.sql   创建数据表
    schema: classpath:db/schema_h2.sql
    # 每次启动都会运行data_h2.sql  初始化表数据
    data: classpath:db/data_h2.sql
  h2:
    console:
      # 开启控制台   可以在浏览器中访问
      enabled: true
      settings:
      	# 开启栈追踪
        trace: true
        # 允许跨域
        web-allow-others: true
  
  # 我的项目用的是jpa, 只需要改一下database-platform就可以, 不需要改动已经写好的代码
  # mybatis也是只正常写代码就好, 不过部分特殊sql需要注意
  jpa:
    hibernate:
      ddl-auto: none
    open-in-view: true
    database-platform: org.hibernate.dialect.H2Dialect
    show-sql: true
    properties:
      format-sql: true
```

**h2执行mysqldump出sql的脚本可能会提示语法错误, 可以参考https://github.com/bgranvea/mysql2h2-converter解决**

在集成h2之后启动项目, 浏览器访问localhost:8080/h2-console可以访问h2数据库的控制台

![image-20210812120223290](http://image.ytg2097.com/img/image-20210812120223290.png)

集成h2之后, 单元测试就不需要再写回滚代码了

```java
    @Test
    void createTeacher() {

        TeacherRegisterRequest registerRequest = new TeacherRegisterRequest();
        registerRequest.setEmail("ytg2097@163.com");
        registerRequest.setName("杨同港");
        String teacherId = teacherService.createTeacher(registerRequest);

        assertNotEquals(teacherId,null);
    }
```

并且h2数据库嵌入到你的应用中, 直接访问本地内存, 速度更快.  同时还避免了与同事共用开发库导致的表冲突问题. 
