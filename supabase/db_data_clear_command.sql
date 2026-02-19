TRUNCATE TABLE
  public.events,
  public.marketplace_listings,
  public.transactions,
  public.user_tickets,
  public.users,
  public.chat_messages,
  public.comments,
  public.royalty_recipients,
  public.royalty_distributions
RESTART IDENTITY
CASCADE;
