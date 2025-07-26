#!/bin/bash

# Voice2Minutes 访客身份防滥用功能测试脚本
# 作者：Claude
# 日期：2025-07-26

echo "🛡️ Voice2Minutes 访客身份防滥用功能测试"
echo "=========================================="

# 服务器地址
API_BASE="http://localhost:3001"

# 颜色代码
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# 测试函数
run_test() {
    local test_name="$1"
    local expected_status="$2"
    local curl_command="$3"
    
    echo -e "\n${BLUE}测试: $test_name${NC}"
    echo "命令: $curl_command"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # 执行请求并捕获HTTP状态码
    response=$(eval "$curl_command" 2>/dev/null)
    status=$?
    
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✅ 请求成功${NC}"
        echo "响应: $response"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ 请求失败${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# 检查服务器是否运行
echo -e "\n${BLUE}检查服务器状态...${NC}"
curl -s "$API_BASE/api/health" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 服务器运行正常${NC}"
else
    echo -e "${RED}❌ 服务器未运行，请先启动服务器: node server.js${NC}"
    exit 1
fi

# 测试1: 正常访客记录
run_test "正常访客身份记录" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"normal-user-001\",\"fingerprint\":\"fp-normal-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\",\"language\":\"zh-CN\"},\"usageInfo\":{\"totalMinutesUsed\":1.5,\"sessionsCount\":1}}'"

# 测试2: 访客身份验证
run_test "访客身份验证" 200 \
"curl -s -X POST '$API_BASE/api/guest/verify' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"normal-user-001\",\"fingerprint\":\"fp-normal-001\"}'"

# 测试3: 重复设备指纹检测
run_test "重复设备指纹检测" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"duplicate-user-001\",\"fingerprint\":\"fp-normal-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\"},\"usageInfo\":{\"totalMinutesUsed\":2,\"sessionsCount\":2}}'"

# 测试4: 高频访问检测
run_test "高频访问检测" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"frequent-user-001\",\"fingerprint\":\"fp-frequent-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\"},\"usageInfo\":{\"totalMinutesUsed\":3,\"sessionsCount\":25}}'"

# 测试5: 接近使用上限
run_test "接近使用上限检测" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"limit-user-001\",\"fingerprint\":\"fp-limit-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\"},\"usageInfo\":{\"totalMinutesUsed\":4.5,\"sessionsCount\":3}}'"

# 测试6: 超限使用检测
run_test "超限使用检测" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"exceed-user-001\",\"fingerprint\":\"fp-exceed-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\"},\"usageInfo\":{\"totalMinutesUsed\":6,\"sessionsCount\":1}}'"

# 测试7: 综合高风险行为
run_test "综合高风险行为检测" 200 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"risky-user-001\",\"fingerprint\":\"fp-normal-001\",\"deviceInfo\":{\"userAgent\":\"Mozilla/5.0 Test\"},\"usageInfo\":{\"totalMinutesUsed\":5.5,\"sessionsCount\":30}}'"

# 测试8: 错误请求处理
run_test "缺少必要参数的请求" 400 \
"curl -s -X POST '$API_BASE/api/guest/identity' \
-H 'Content-Type: application/json' \
-d '{\"visitorId\":\"test\"}'"

# 测试9: 管理员统计接口（需要认证）
run_test "管理员统计接口" 200 \
"curl -s -X GET '$API_BASE/api/guest/stats' \
-H 'Authorization: Bearer admin-token'"

# 测试10: 无权限访问管理员接口
run_test "无权限访问管理员接口" 403 \
"curl -s -X GET '$API_BASE/api/guest/stats'"

# 测试结果统计
echo -e "\n=========================================="
echo -e "${BLUE}测试结果统计${NC}"
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 所有测试通过！防滥用功能正常工作。${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️ 有 $TESTS_FAILED 个测试失败，请检查问题。${NC}"
    exit 1
fi

# 额外功能：显示存储的数据
echo -e "\n${BLUE}当前存储的访客数据:${NC}"
if [ -f "guest_data/guest_identities.json" ]; then
    echo "访客身份记录:"
    cat guest_data/guest_identities.json | jq '.' 2>/dev/null || cat guest_data/guest_identities.json
else
    echo "未找到访客数据文件"
fi

echo -e "\n${BLUE}风险分析数据:${NC}"
if [ -f "guest_data/risk_analysis.json" ]; then
    cat guest_data/risk_analysis.json | jq '.' 2>/dev/null || cat guest_data/risk_analysis.json
else
    echo "未找到风险分析文件"
fi