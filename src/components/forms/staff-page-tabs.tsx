'use client';

import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { StaffCrud } from '@/components/forms/staff-crud';
import { RolesCrud } from '@/components/forms/roles-crud';

/** Staff screen: members on one tab, admin-managed roles + menus on the other. */
export function StaffPageTabs({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<'members' | 'roles'>('members');
  return (
    <Box>
      <Tabs value={tab} onChange={(_, v: 'members' | 'roles') => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="members" label="พนักงาน" />
        <Tab value="roles" label="สิทธิ์และเมนู" />
      </Tabs>
      {tab === 'members' ? <StaffCrud /> : <RolesCrud isAdmin={isAdmin} />}
    </Box>
  );
}
