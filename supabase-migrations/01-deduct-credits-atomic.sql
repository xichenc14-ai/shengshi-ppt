-- Supabase RPC: deduct_credits_atomic
-- 原子性积分扣除，防止并发超扣
-- 在 Supabase SQL Editor 中执行此脚本

CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT ''
)
RETURNS TABLE(new_balance INTEGER) AS $$
DECLARE
  v_new_balance INTEGER;
  v_old_credits INTEGER;
BEGIN
  -- 1. 锁定用户行并检查余额（FOR UPDATE 防止并发读写）
  SELECT credits INTO v_old_credits
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_old_credits < p_amount THEN
    -- 余额不足，返回空（调用方检查 null）
    RETURN;
  END IF;

  -- 2. 扣除积分 + 累计用量
  v_new_balance := v_old_credits - p_amount;

  UPDATE users
  SET credits = v_new_balance,
      total_credits_used = COALESCE(total_credits_used, 0) + p_amount
  WHERE id = p_user_id;

  -- 3. 记录流水
  INSERT INTO credit_transactions (user_id, amount, balance_after, type, description)
  VALUES (p_user_id, -p_amount, v_new_balance, 'generation', p_description);

  -- 4. 返回新余额
  RETURN QUERY SELECT v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
