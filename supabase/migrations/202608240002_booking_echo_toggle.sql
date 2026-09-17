-- Per-shop toggle for the booking echo message.
--
-- After a successful LIFF booking the client sends one message into the OA chat
-- on the customer's behalf, because LINE only raises an unread badge in LINE OA
-- Chat for inbound messages — the Flex confirmation the server pushes is
-- outbound and never notifies the shop.
--
-- Some shops will not want a message that looks like the customer typed it, so
-- the behaviour is opt-out per shop. Default on: shops that never touch the
-- setting get the notification they asked for.

alter table shops
  add column if not exists booking_echo_enabled boolean not null default true;

comment on column shops.booking_echo_enabled is
  'When true, LIFF sends an inbound echo message after a successful booking so LINE OA Chat raises an unread badge for the shop.';
