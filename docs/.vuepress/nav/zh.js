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
                text: '响应式',
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
            {
                text: 'Netty',
                items: [
                    {
                        text: '导航',
                        link: '/netty/'
                    }
                ]
            },

        ]
    },
    {
        text: '数据库',
        items: [
            {
                text: 'MySQL',
                link: '/ground/mysql/'
            }, {
                text: 'Redis',
                link: '/ground/redis/'
            },
            {
                text: 'Mongo',
                link: '/ground/mongo/'
            },
        ]
    },
    {
        text: '中间件',
        items: [
            {
                text: 'Kafka',
                link: '/ground/kafka/'
            }, {
                text: 'ES',
                link: '/ground/es/'
            },
        ]
    },
    {
        text: '云原生',
        items: [
            {text: 'Docker', link: 'https://yeasy.gitbook.io/docker_practice/'},
            {
                text: 'k8s',
                items: [{text: 'k8s入门', link: '/container/k8s'},
                    {text: 'k8s网络一: Linux网络与Docker网络', link: '/container/k8s-network'},
                    {text: 'k8s网络二: Pod通信与服务发现', link: '/container/k8s-network2'},
                    {text: 'k8s网络三: 网络插件', link: '/container/k8s-network3'},
                    {text: 'k8s存储一: 待定', link: '/container/k8s-storage'},
                    {text: 'k8s-CICD', link: '/container/k8s-CICD'},
                    {text: 'k8s安全', link: '/container/k8s-secure'},
                    {text: 'k8s集群搭建', link: '/container/k8s-cluster'},]
            },
            {
                text: '服务网格',
                items: [{text: '认识服务网格', link: '/container/service-mesh-1'},
                    {text: 'Istio', link: '/container/service-mesh-2'},
                ]
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
