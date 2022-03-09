---
sidebar: auto
---
# Go语言特性一
1. go不支持隐式类型转换， 也不支持别名类型与原类型的转换

2. go文件的package不要求必须与go文件所在的目录名相同

3. go的测试文件要以 "_test.go" 结尾

4. go的测试方法要以 "Test" 开头

5. go不支持指针运算

6. go中的string是数值类型， 所以它的零值是空字符串 ""

7. go中没有 ++i ， 只有 i++

8. go中数组 == 比较时， 只有数组维度相同且元素数量相同时才可以比较；且 == 比较会同时比较数组中的元素是否 顺序，值 全部相同

9. &^ 按位清零

   操作符右边的第 x 位为 0 时，那么运算结果的第 x 位为操作符左边的数值的第 x 位。

   操作符右边的第 x 位为 1时， 那么运算结果的第 x 位数值为 0 。

   **一般用来 &^ 1， 做按位清零用**

   example

   ```
   a := 11 
   b := 9	
   c := a &^ b   
   
   fmt.Print(c) // c = 2
   
   --------
      1011  
   &^ 1001
   --------
      0010 
   ```

10. go中只有for循环没有while

    ```go
    // while循环
    for a < 5 {
    ...
    }
    
    // 无限循环
    for {
    ...
    }
    
    // foreach
    for index,e := range arr {
      ...
    }
    ```

11. go中的 if 可以在 condition 中为变量赋值

    ```go
    if a := 1 == 1; a {
    ...
    }
    ```

12. switch 中不需要写break， 有自动break

    ```go
    switch a {
    	case a >= 100 && a < b{
    	 // 类似 if else
    	}
      case 11，22 {
        // 命中 11 或 22 都会进入case
      }
    }
    ```

13. 数组的声明方式

    ```go
    var arr [2]int
    arr1 := [3]int{1,2,3}
    arr2 := [...]int{1,2,3,4,5,6}
    ```

14. slice

    slice是一个 “视图” 对象， 修改slice会同时修改掉底层的数组。

    slice之间不能比较。

    - create

        - 从数组创建

          ```go
          func TestSliceCreateFromArr(t *testing.T) {
          
              arr := [...]int{1, 2, 3, 4, 5, 6, 7, 8}
              // 切片为 start   end - 1
              // 切片的第二个数字不是取多少个   而是到第几个角标 - 1
              slice1 := arr[2:5]
              slice2 := arr[:5]
              slice3 := arr[2:]
              slice4 := arr[:]
              t.Log(slice1)
              t.Log(slice2)
              t.Log(slice3)
              t.Log(slice4)
          
              // slice还可以在被切片   被切片之后底层的数组是相同的
              slice5 := slice4[2:]
              t.Log(slice5)
          }
          // 控制台输出
          === RUN   TestSliceCreate
              slice_test.go:17: [3 4 5]
              slice_test.go:18: [1 2 3 4 5]
              slice_test.go:19: [3 4 5 6 7 8]
              slice_test.go:20: [1 2 3 4 5 6 7 8]
              slice_test.go:24: [3 4 5 6 7 8]
          ```

          slice在对arr做视图的同时，视图右边的没有纳进视图的部分也是slice可见的，如果对s1再次slice时，即使超出了s1的len，但是只要没有超出底层数组的len，那么依然可以slice成功。

          slice的底层结构有三个属性：
          ptr：视图在原数组的index
          len：视图的长度
          cap： ptr到原数组的尾端的长度

          可以这么理解：slice[x:y]会拥有数组的从x开始直到结束的所有元素，y是不能超过数组的长度的但是切片之后，我们只可见数组的x:y部分的元素这个x在slice中就是ptr，x到数组尾部的长度成为capacity，slice的长度len就是y - x如果再次对slice进行切片，x是相对于slice的,而y还是相对于原数组的。

          明白以上几点之后再去看slice的操作会清晰很多。

        - 声明

          ```go
          func TestSliceDeclare(t *testing.T) {
          
              // 不从array创建, 直接定义一个slice  这里声明的类型是[]int不是[]int{}
              var s []int
              for i := 0; i < 100; i++ {
                  // 当cap不足进行扩容时， 也就是len要大于cap时， cap是二倍扩容的
                  s = append(s, 2*i+1)
                  printSlice(s, t)
              }
              // 通过make创建
              s1 := make([]int, 10)
              s2 := make([]int, 16)
              printSlice(s1, t)
              printSlice(s2, t)
          }
          
          func printSlice(s []int, t *testing.T) {
              t.Log(len(s), cap(s))
          }
          ```

    - append

      append不会影响原slice，他会返回一个新的slice:  slice长度 + 1 ，尾部值为新添加的元素。

      append的元素是在slice的末尾添加的，只要添加的元素位置没有超过slice的cap，那么这个元素就会直接映射到原数组所在的位置上。

      如果append的元素超过了slice的cap，那么go就会从原来的arr复制一个出来，长度更长（二倍扩容），然后把新元素放到上面去。

      当arr改变之后，slice的ptr，cap，len都会改变，所以会返回一个新的slice。

      原来的arr如果没有使用的话会被垃圾回收。

      ```go
      func TestSliceAppend(t *testing.T) {
      
      	arr := [...]int{0, 1, 2, 3, 4, 5, 6, 7}
      	s1 := arr[2:6] // s1 = 	   2, 3, 4, 5 _6,_7
      	s2 := s1[3:5]  // s2 = 		          5, 6,_7
      	t.Log("arr = ", arr)
      	t.Log("s1 = ", s1)
      	t.Log("s2 = ", s2)
      	s3 := append(s2, 10) // s3 = 			  5, 6, 10
      	s4 := append(s3, 11) // s4 = 			 	5, 6, 10, 11
      	s5 := append(s4, 12) // s5 = 			  5, 6, 10, 11, 12
      	t.Log("s3 = ", s3)
      	t.Log("s4 = ", s4)
      	t.Log("s5 = ", s5)
      	// 这里切片底层的数组已经不是arr了， 而是go二倍扩容后的新数组， 所以新添加的 11，12元素在arr中是没有的， arr中只能看到第一次append的元素 10
      	t.Log("arr = ", arr)
      }
      ```

      **这里要注意， 由于切片在扩容后可能会更换底层的数组， 可能会引发一些意想不到的错误**

    - delete

      删除其实就是再切片一次

      ```go
      // 删除头部
      func TestSliceDeleteTail(t *testing.T) {
      	var s1 []int
      	for i := 0; i < 10; i++ {
      		s1 = append(s1, 2*i+1)
      	}
      	t.Log(s1) // [1 3 5 7 9 11 13 15 17 19]
      	s1 = s1[:len(s1)-1]
      	t.Log(s1) // [1 3 5 7 9 11 13 15 17]
      }
      
      // 删除尾部
      func TestSliceDeleteHead(t *testing.T) {
      	var s1 []int
      	for i := 0; i < 10; i++ {
      		s1 = append(s1, 2*i+1)
      	}
      	t.Log(s1) // [1 3 5 7 9 11 13 15 17 19]
      	s1 = s1[1:]
      	t.Log(s1) // [3 5 7 9 11 13 15 17 19]
      }
      
      // 删除中间
      func TestSliceDeleteMid(t *testing.T) {
      	var s1 []int
      	for i := 0; i < 10; i++ {
      		s1 = append(s1, 2*i+1)
      	}
      
      	// 删除slice中的某个元素的思想是将slice当做一把尺子, 比如尺子从1到10, 删掉3就是从3位置折断
      	// 然后将两节尺子叠到一起, 将4覆盖住原来3的位置
      	// 1,2,3,4,5,6,7,8,9,10
      	//	   3被盖住
      	// 1,2,4,5,6,7,8,9,10
      	// 换成代码就是s[:3] + s[4:]
      	t.Log(s1)
      	s1 = append(s1[:3], s1[4:]...)
      	t.Log(s1)
      }
      ```



    - copy

      ```go
      func TestSliceCopy(t *testing.T) {
      
      	var s1 []int
      	for i := 0; i < 10; i++ {
      		s1 = append(s1, 2*i+1)
      	}
      
      	s2 := make([]int, 16)
      	copy(s2, s1)
      	t.Log(s1, len(s1), cap(s1))
      	t.Log(s2, len(s2), cap(s2))
      }
      ```



15. map

    go中map是hashmap

    go中除了slice, map, func之外都可以作为map的key

    go中自定义类型struct也可作为key, 只要field中不包含slice, map, func就可以

    - 初始化map

      ```go
      func TestMapCreate(t *testing.T){
      	m := map[int]string{
      		1: "123",
      		2: "345",
      	}
      	t.Log(m)
      
      	m1 := map[int]map[string]string{
      		1: {"age": "123", "name": "123"},
      		2: {"age": "123", "name": "123"},
      	}
      	t.Log(m1)
      
      	// 新建空map   得到的map是 empty map
      	m2 := make(map[int]string)
      	t.Log(m2)
      
      	// 新建空map   得到的map是 nil
      	var m3 map[string]int
      	t.Log(m3)
        
        // 遍历map
      	for key, val := range m {
      		t.Log(key, val)
      	}
      }
      ```

    - 访问map

      ```go
      func TestMapAccess(t *testing.T){
      	
      	m := make(map[int]string)
      	if val,ok := m[1]; ok {
      	  t.Log(val)
      	}
      }
      ```

      即使key在map中不存在， map也不会返回nil，而是会返回变量的零值， 所以为了防止零值参与运算，要先判断key是否存在

    - 删除key

      ```go
      func TestMapDelete(t *testing.T){
      	
        m := make(map[int]string){1:"123"}
        delete(m,1)
      }
      ```

16. 字符串

    go中的字符串是基本数据类型，不是引用类型。由于是基本数据类型所以它的零值是 "" ，而不是 nil。

    string底层是只读的byte slice，所以 len 函数拿到的不是字符数而是byte数。

    string的byte数组可以存放任何数据。



    ```go
    func TestStringToRune(t *testing.T){
    	str := "中文"
    	t.Log(len(str))      //输出6
    	chinese := []rune(str)
    	t.Log(len(chinese))  //输出2
      
      for _,c := range str {
        t.Logf("%[1]c  %[1]d", c) 
        // 输出
        // 中  20013
        // 文  25991
      }
    }
    ```

    > Unicode是一种很大的**符号集**，它包含了100多万种字符，但它只规定了字符的二进制代码，没有规定二进制代码应该如何存储。有的字符可能一个字节就能表示，比如英文；有的字符可能需要两三个字节来表示。Unicode并没有规定固定的几个字节（比如三个）表示一个字符，否则如果使用Unicode字符集表示英文的话，每个字符都会浪费两个字节的存储空间；
    >
    > UTF8是Unicode的**存储实现**。它是一种变长的编码方式。使用1～4个字节存储单个字符。

    

    **Go语言是UTF8编码的，rune能够将string的 byte slice按照Unicode编码转换出对应的码点。rune实质上是int32。**

    

    - 常用函数

      string相关的常用的函数都在strings包中

      ```go
      func TestStringFunc(t *testing.T){
        s := "1,2,3"
        chars := strings.Split(s,",")
        s := strings.Join(chars,"-")
      }
      ```

      

    - 类型转换

      stirng与其他类型的转换的函数在strconv包中。

      ```go
      func TestStringConv(t *testing.T){
        s := strconv.Itoa(10)
        i,err := strconv.Atoi("20") // Atoi会返回两个
      }
      ```

17. 函数

    go的函数可以有多个返回值。

    go的所有参数都是值传递。

    go的函数可以作为变量的值。

    go的函数可以作为参数和返回值。

    ```go
    func timeSpent(inner func(op int) int) func(op int) int {
        // 装饰者模式
        return func(n int) int {
            start := time.Now()
            ret := inner(n)
            fmt.Println("time spent:", time.Since(start).Seconds())
            return ret
        }
    }
    func slowFunc(op int) int {
        time.Sleep(time.Second * 2)
        return op
    }
    
    func TestFunc(t *testing.T) {
    
        newFunc := timeSpent(slowFunc)
        i := newFunc(20)
        t.Log(i)
    }
    ```

18. Go中的可变长参

    ```go
    func sum(arr ...int) int {
    
       fmt.Print(reflect.TypeOf(arr))// []int
       ret := 0
       for _, i := range arr {
          ret = ret + i
       }
       return ret
    }
    ```

    可变长参数接受之后其实是切片。

19. 延迟执行函数defer

    延迟执行函数并不是异步，而是类似finally代码块。

    ```
    func TestDefer(t *testing.T){
        defer Clear()
        t.Log("执行")
        panic("error") //即使发生panic，defer函数也会执行。
    }
    func Clear(){
        fmt.Println("clear resources")
    }
    ```
20. Go常用的格式化输出占位符表

    | 占位符 |                             含义                             |
            | :----: | :----------------------------------------------------------: |
    |   %v   | 以默认的方式打印变量的值（万能占位符，如果不知道变量是什么类型，用%v即可，go语言会自动为你识别） |
    |   %T   |                        打印变量的类型                        |
    |   %%   |                字面上的百分号，并非值的占位符                |
    |  %+v   |              类似%v，但输出结构体时会添加字段名              |
    |   %t   |                         true或false                          |
    |   %b   |                         表示为二进制                         |
    |   %c   |                    该值对应的unicode码值                     |
    |   %d   |                         表示为十进制                         |
    |   %o   |                         表示为八进制                         |
    |   %x   |                   表示为十六进制，使用a-f                    |
    |   %X   |                   表示为十六进制，使用A-F                    |
    |   %s   |                   直接输出字符串或者[]byte                   |
    |   %q   | 该值对应的双引号括起来的go语法字符串字面值，必要时会采用安全的转义表示 |
    |   %p   |                表示为十六进制，并加上前导的0x                |
    

> 字符集：http://www.ruanyifeng.com/blog/2007/10/ascii_unicode_and_utf-8.html?from=timeline

