insert into public.roles (code, name) values
('super_admin', 'Super Admin'),
('shop_owner', 'Shop Owner'),
('branch_manager', 'Branch Manager'),
('staff', 'Staff'),
('customer', 'Customer')
on conflict (code) do update set name = excluded.name;

insert into public.permissions (code, name) values
('manage_company', 'Manage company'),
('manage_shop', 'Manage shop'),
('manage_branch', 'Manage branch'),
('manage_service', 'Manage service'),
('manage_booking', 'Manage booking'),
('view_reports', 'View reports'),
('manage_line', 'Manage LINE integration')
on conflict (code) do update set name = excluded.name;
