TRUNCATE TABLE
  public.events,
  public.marketplace_listings,
  public.transactions,
  public.user_tickets,
  public.users,
  public.chat_messages,
  public.comments,
  public.royalty_recipients,
  public.royalty_distributions,
  public.auth_nonces,
  public.refresh_tokens
RESTART IDENTITY
CASCADE;
