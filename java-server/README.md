# 考勤系统 Java 后端（java-server）

JDK8 + Spring Boot 2.7 + MyBatis-Plus + MySQL + EasyExcel 实现的考勤系统后端，**无损替换**原 Node.js/Express 版本。

## 技术栈

| 组件 | 版本 |
|------|------|
| JDK | 8 |
| Spring Boot | 2.7.18 |
| MyBatis-Plus | 3.5.5 |
| MySQL | 8.x / 26.x（驱动 mysql-connector-j 9.5.0） |
| EasyExcel | 3.3.4 |
| jjwt | 0.9.1（HS256） |
| BCrypt | spring-security-crypto（兼容 bcryptjs `$2a$`） |

## 无损替换要点

- **前端零改动**：所有 API 响应字段（snake_case）、`message` 文案、状态码与原 Node 版一致
- **密码兼容**：bcrypt 哈希算法相同，历史密码无需重置
- **特例**：`/api/dashboard/summary` 响应为 camelCase（`userId/userName/employeeId/...`），与原前端契约一致

## 快速开始

```bash
# 1. 准备 JDK8 + Maven + MySQL（建库 attendance_db）
# 2. 启动
cd java-server
mvn clean package -DskipTests
java -jar target/attendance-server.jar
```

默认连接 `127.0.0.1:3306/attendance_db`（root/root），可在 `application.yml` 修改。
启动时自动建表（`schema.sql`）并创建默认管理员 `admin/admin123`。

## 数据迁移（SQLite → MySQL）

```bash
NODE_PATH=../server/node_modules node ../docs/migrate-sqlite-to-mysql.js
```

## 测试

```bash
mvn test          # 89 个用例（含 118 个 Node 用例的等价覆盖）
```

- `BusinessRulesTest` — 纯逻辑单元
- `ApiTest/UsersTest/TeamsTest/ProjectsTest/HolidaysTest/OvertimeTest/LeaveTest/AttendanceTest/RequestsTest/DashboardTest` — HTTP 集成测试（连 `attendance_test` 库）

## 目录结构

```
java-server/
├── pom.xml
├── src/main/java/com/attendance/
│   ├── AttendanceApplication.java
│   ├── common/      (UserContext, BizException, GlobalExceptionHandler)
│   ├── config/      (JWT, MyBatis-Plus, CORS, Jackson, DataInitializer)
│   ├── security/    (JwtUtil, AuthInterceptor, RequireRole)
│   ├── entity/      (9 张表实体)
│   ├── mapper/      (9 个 Mapper)
│   ├── controller/  (13 组接口)
│   ├── util/        (BusinessRules, CsvUtil, CsvResponse)
│   └── dto/vo/      (请求/响应体)
└── src/main/resources/
    ├── application.yml
    ├── application-prod.yml
    └── sql/schema.sql
```
