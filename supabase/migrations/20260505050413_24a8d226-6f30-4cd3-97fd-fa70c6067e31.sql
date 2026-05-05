INSERT INTO public.user_roles (user_id, role)
VALUES ('5f9c3d1b-4aaf-4743-8489-0b41e84c2564', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles SET token_balance = GREATEST(token_balance, 1000000000), accepted_terms = true
WHERE id = '5f9c3d1b-4aaf-4743-8489-0b41e84c2564';