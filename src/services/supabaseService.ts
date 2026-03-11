import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const supabaseService = {
  async saveMessage(role: 'user' | 'assistant', content: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{ role, content, timestamp: new Date().toISOString() }]);
      
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Save Error:", e);
    }
  },

  async getMessages() {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Supabase Fetch Error:", e);
      return [];
    }
  },

  async saveReminder(reminder: any) {
    try {
      const { error } = await supabase
        .from('reminders')
        .upsert([reminder]);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Save Reminder Error:", e);
    }
  },

  async getReminders() {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*');
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Supabase Fetch Reminders Error:", e);
      return [];
    }
  },

  async deleteReminder(id: string) {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Delete Reminder Error:", e);
    }
  },

  async saveContact(contact: any) {
    try {
      const { error } = await supabase
        .from('contacts')
        .upsert([contact]);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Save Contact Error:", e);
    }
  },

  async getContacts() {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*');
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Supabase Fetch Contacts Error:", e);
      return [];
    }
  },

  async deleteContact(id: string) {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Delete Contact Error:", e);
    }
  },

  async savePlugin(plugin: any) {
    try {
      const { error } = await supabase
        .from('plugins')
        .upsert([plugin]);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Save Plugin Error:", e);
    }
  },

  async getPlugins() {
    try {
      const { data, error } = await supabase
        .from('plugins')
        .select('*');
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("Supabase Fetch Plugins Error:", e);
      return [];
    }
  },

  async deletePlugin(id: string) {
    try {
      const { error } = await supabase
        .from('plugins')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.error("Supabase Delete Plugin Error:", e);
    }
  }
};
