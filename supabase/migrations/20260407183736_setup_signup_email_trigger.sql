-- Create trigger to send signup email via Resend when user signs up
-- This requires the send-signup-email Edge Function to be deployed

-- Create a function that calls the Edge Function
create or replace function public.handle_new_user_signup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_record record;
begin
  select * into user_record
  from auth.users
  where id = auth.uid()
  limit 1;

  if user_record is not null then
    -- Call the send-signup-email Edge Function
    perform net.http_post(
      url := (
        select
          coalesce(
            nullif(current_setting('app.supabase_url'), ''),
            'https://gbenibgytweskljxneup.supabase.co'
          )
          || '/functions/v1/send-signup-email'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.anon_key')
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', user_record.id,
          'email', user_record.email,
          'raw_user_meta_data', user_record.raw_user_meta_data
        )
      )
    );
  end if;
exception when others then
  raise warning 'Error sending signup email: %', sqlerrm;
end;
$$;

-- Create a trigger that fires when a new auth user is created
-- Note: This trigger runs on the auth.users table
-- You may need to set this up in the Supabase dashboard if this fails
-- as the auth schema has special handling in some Supabase versions
