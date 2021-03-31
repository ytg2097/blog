---
sidebar: auto
next: ./clone
prev: ./singleton
---

# 工厂模式

工厂模式分为简单工厂模式, 工厂方法模式与抽象工厂模式三种.  

## 简单工厂模式

简单工厂其实我们都不陌生, 它将对象的获取入口约束到一个类或方法中. 外部服务如果要获取或创建一个对象时, 需要通过调用工厂方法去获取对象实例. 在实际开发中, 我自己应用最多的场景是用来实现DDD中聚合工厂的角色. 

这里简单实现一个账号的创建流程. 

**账号聚合根对象**

```java 
@EqualsAndHashCode(callSuper = false)
@Entity
@Data
@Where(clause = "valid=" + Constants.FLAG_NOT_DELETED )
public class Account extends BaseEntity {

    @Id
    private String id;
    
    ...
    
    @Enumerated(EnumType.STRING)
    private AccountLevel accountLevel;

    @Where(clause = "valid = 1")
    @ManyToMany(cascade = {CascadeType.PERSIST}, fetch = FetchType.EAGER)
    @JoinTable(name = "account_role",
            joinColumns = {
                    @JoinColumn(name = "account_id", referencedColumnName = "id",
                            foreignKey = @ForeignKey(name = "none", value = ConstraintMode.NO_CONSTRAINT))},
            inverseJoinColumns = {
                    @JoinColumn(name = "role_id", referencedColumnName = "id",
                            foreignKey = @ForeignKey(name = "none", value = ConstraintMode.NO_CONSTRAINT))}
    )
    private List<Role> roles;
```

当实例的创建逻辑比较简单时, 可以在类的内部定义一个静态的工厂方法. 当创建逻辑复杂时, 可以考虑将工厂方法提取出来作为一个单独的工厂类.  

上面已经说明我们可能会创建多种权限级别的账号, 那么也就可能会出现多种实例化账号的入口. 所以我们这时可以采用工厂类的形式将账号的创建入口约束到一起. 

**账号工厂**

```java 
@Component
public class AccountFactory {

    /**
     * 创建租户下级账号
     * @param createCommand
     * @return
     */
    public Account createOrdinary(AccountCreateCommand createCommand) {

        Account account = create(createCommand);
        account.setAccountLevel(ORDINARY);
        if(nonNull(createCommand.getRoleIds())){
            account.setRoles(createCommand.getRoleIds().stream().map(Role::new).collect(Collectors.toList()));
        }
        return account;
    }

    private Account create(AccountCreateCommand createCommand){

        Account entity = new Account();
        entity.setId(gen32());
        ...
        return entity;
    }
}
```

在简单工厂中, 外部服务不需要知道实例是如何创建的, 只需要提供对应的参数即可, 对于复杂的类的实例创建, 简单工厂模式可以使外部服务只关注实例的使用. 实现了单一职责. 

## 工厂方法模式

工厂方法模式中有一个顶级工厂的角色, 可能是一个接口或抽象类, 它定义了获取类实例的方法, 而后由具体的子工厂实现类去分别实例化类的实例. 往往这些类实例都会实现一个相同的接口. 

### MyBatis中的使用

每个orm框架中都会有一个DateSource类, Mybatis中使用了工厂方法模式去获取DataSource的实例. 它提供了一个DataSourceFactory接口, 其中定义了获取DataSource的方法, 这个接口的各个子类完成了获取不同类型DataSource的实现. 

```java 
public interface DataSourceFactory {
    void setProperties(Properties var1);

    DataSource getDataSource();
}

public class JndiDataSourceFactory implements DataSourceFactory {
    public static final String INITIAL_CONTEXT = "initial_context";
    public static final String DATA_SOURCE = "data_source";
    public static final String ENV_PREFIX = "env.";
    private DataSource dataSource;

    public JndiDataSourceFactory() {
    }

    public void setProperties(Properties properties) {
        try {
            Properties env = getEnvProperties(properties);
            InitialContext initCtx;
            if (env == null) {
                initCtx = new InitialContext();
            } else {
                initCtx = new InitialContext(env);
            }

            if (properties.containsKey("initial_context") && properties.containsKey("data_source")) {
                Context ctx = (Context)initCtx.lookup(properties.getProperty("initial_context"));
                this.dataSource = (DataSource)ctx.lookup(properties.getProperty("data_source"));
            } else if (properties.containsKey("data_source")) {
                this.dataSource = (DataSource)initCtx.lookup(properties.getProperty("data_source"));
            }

        } catch (NamingException var5) {
            throw new DataSourceException("There was an error configuring JndiDataSourceTransactionPool. Cause: " + var5, var5);
        }
    }

    public DataSource getDataSource() {
        return this.dataSource;
    }

}
public class UnpooledDataSourceFactory implements DataSourceFactory {

    // 初始化UnpooledDataSourceFactory时创建一个DataSource实例
    protected DataSource dataSource = new UnpooledDataSource();

    public UnpooledDataSourceFactory() {
    }

    public DataSource getDataSource() {
        return this.dataSource;
    }

}

```

工厂方法模式比较适合实例类型数量固定的场景, 如果有增加新的实例类型的时候, 不需要修改代码, 符合开闭原则. 但是如果实例类型过多时会出现工厂类爆炸的情况, 这时就不建议使用了. 
 
## 抽象工厂模式

在工厂方法模式中, 顶级工厂只定义一个类实例获取的方法, 子工厂分别去实现; 而抽象工厂模式中, 顶级工厂会定义一系列的获取相关类实例的方法.   

### JDK中的使用

```java 

public abstract class TransformerFactory {
    ...
    public abstract Transformer newTransformer(Source var1) throws TransformerConfigurationException;

    public abstract Transformer newTransformer() throws TransformerConfigurationException;

    public abstract Templates newTemplates(Source var1) throws TransformerConfigurationException;
    ...
}

public abstract class SAXTransformerFactory extends TransformerFactory {
    public static final String FEATURE = "http://javax.xml.transform.sax.SAXTransformerFactory/feature";
    public static final String FEATURE_XMLFILTER = "http://javax.xml.transform.sax.SAXTransformerFactory/feature/xmlfilter";

    protected SAXTransformerFactory() {
    }

    public abstract TransformerHandler newTransformerHandler(Source var1) throws TransformerConfigurationException;

    public abstract TransformerHandler newTransformerHandler(Templates var1) throws TransformerConfigurationException;

    public abstract TransformerHandler newTransformerHandler() throws TransformerConfigurationException;

    public abstract TemplatesHandler newTemplatesHandler() throws TransformerConfigurationException;

    public abstract XMLFilter newXMLFilter(Source var1) throws TransformerConfigurationException;

    public abstract XMLFilter newXMLFilter(Templates var1) throws TransformerConfigurationException;
}

public class SmartTransformerFactoryImpl extends SAXTransformerFactory {

    ...
    public Transformer newTransformer()
        throws TransformerConfigurationException
    {
        if (_xalanFactory == null) {
            createXalanTransformerFactory();
        }
        if (_errorlistener != null) {
            _xalanFactory.setErrorListener(_errorlistener);
        }
        if (_uriresolver != null) {
            _xalanFactory.setURIResolver(_uriresolver);
        }
        _currFactory = _xalanFactory;
        return _currFactory.newTransformer();
    }

    public Transformer newTransformer(Source source) throws
        TransformerConfigurationException
    {
        if (_xalanFactory == null) {
            createXalanTransformerFactory();
        }
        if (_errorlistener != null) {
            _xalanFactory.setErrorListener(_errorlistener);
        }
        if (_uriresolver != null) {
            _xalanFactory.setURIResolver(_uriresolver);
        }
        _currFactory = _xalanFactory;
        return _currFactory.newTransformer(source);
    }


    public Templates newTemplates(Source source)
        throws TransformerConfigurationException
    {
        if (_xsltcFactory == null) {
            createXSLTCTransformerFactory();
        }
        if (_errorlistener != null) {
            _xsltcFactory.setErrorListener(_errorlistener);
        }
        if (_uriresolver != null) {
            _xsltcFactory.setURIResolver(_uriresolver);
        }
        _currFactory = _xsltcFactory;
        return _currFactory.newTemplates(source);
    }
    ...    
}

```

