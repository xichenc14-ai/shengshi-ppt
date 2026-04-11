# Vercel 环境变量配置清单
# ========================================
# 在 Vercel Dashboard → Settings → Environment Variables 中配置
# 所有变量均在 Production / Preview / Development 三个环境中设置
#
# ⚠️ 实际密钥值请从 .env.local 或联系技术负责人获取，不要在此文件中存储

# ===== AI API Keys =====
GAMMA_API_KEY=<从.env.local获取>
MINIMAX_API_KEY=<从.env.local获取>
MYDAMOXING_API_KEY=<从.env.local获取>
GLM_API_KEYS=<逗号分隔的GLM Key列表>
GLM_API_BASE=https://mydamoxing.cn/v1/chat/completions

# ===== Supabase =====
NEXT_PUBLIC_SUPABASE_URL=<Supabase项目URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase Service Role Key>
SUPABASE_ANON_KEY=<Supabase Anon Key>

# ===== Analytics (可选) =====
# NEXT_PUBLIC_BAIDU_TONGJI_ID=你的百度统计ID
# NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# ===== Test Accounts (仅Preview/Dev环境) =====
# TEST_ADMIN_PWD=your_admin_password
# TEST_XICHEN_PWD=your_xichen_password
