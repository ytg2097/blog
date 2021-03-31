module.exports = [
    {
        text: 'DDD',
        link: '/ddd/'
    },
    {
        text: '微服务',
        link: '/microservice/'
    },

    {
        text: 'Netty',
        link: '/netty/'
    },
    {
        text: '并发',
        link: '/concurrent/'
    },
    {
        text: 'JVM',
        link: '/jvm/'
    },
    {
        text: 'Java基础',
        link: '/base/'
    },
    {
        text: '设计模式',
        link: '/design/'
    },
    {
        text: '框架',
        items: [
            {
                text: 'Spring Cloud',
                items: [
                    {
                        text: 'Eureka',
                        link: '/spring/cloud/eureka'
                    },
                    {
                        text: 'Gateway',
                        link: '/spring/cloud/gateway'
                    },
                    {
                        text: 'Feign',
                        link: '/spring/cloud/feign'
                    }
                ]
            },
            {
                text: 'Spring Boot',
                items: [
                    {
                        text: '自定义starter',
                        link: '/spring/boot/starter/'
                    },
                ]
            },
            {
                text: 'ORM',
                items: [
                    {
                        text: 'JPA',
                        link: '/orm/jpa/'
                    },
                    {
                        text: 'MyBatis',
                        link: '/orm/mybatis/'
                    },
                ]
            },
            {
                text: '响应式编程框架',
                items: [
                    {
                        text: '响应式宣言',
                        link: '/reactive/'
                    },
                    {
                        text: 'RXJava',
                        link: '/reactive/rxjava'
                    },
                    {
                        text: '响应式流',
                        link: '/reactive/reactive-streams'
                    },
                    {
                        text: 'Reactor',
                        link: '/reactive/projectreactor'
                    }
                ]

            },

        ]
    },
    {
      text: '基础设施',
      items:[
          {
              text: 'MySQL',
              link: '/ground/mysql/'
          },{
              text: 'Redis',
              link: '/ground/redis/'
          },{
              text: 'Kafka',
              link: '/ground/kafka/'
          },{
              text: 'ES',
              link: '/ground/es/'
          },{
              text: 'Mongo',
              link: '/ground/mongo/'
          },
      ]
    },
    {
        text: '架构',
        items: [
            {
                text: '六边形',
                link: '/architecture/hexagon',
            },
            {
                text: '清洁架构',
                link: '/architecture/clean',
            },

        ]
    },
    {
        text: '更多',
        link: '/more/'
    },
    {
        text: '随笔',
        link: '/essay/'
    },

]
