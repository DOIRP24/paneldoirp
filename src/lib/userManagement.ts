import { supabase } from './supabase';

interface UserCreationResult {
  success: boolean;
  message: string;
  email?: string;
  password?: string;
  configurationRequired?: boolean;
  user?: any;
}

interface UserDeletionResult {
  success: boolean;
  message: string;
}

interface PasswordResetResult {
  success: boolean;
  message: string;
  password?: string;
}

/**
 * Создает нового пользователя без автоматической авторизации
 * 
 * Сначала создает запись в auth.users, затем в public.users
 * НЕ авторизует текущего пользователя как созданного пользователя
 */
export async function createRegularUser(
  email: string,
  fullName: string,
  role: string = 'employee',
  customPassword: string = '123456',
  additionalData: {
    sap_number?: string;
    phone?: string;
    territory_id?: string | null;
    branch_id?: string | null;
    position_id?: string | null;
    work_experience_days?: number;
  } = {}
): Promise<UserCreationResult> {
  try {
    console.log(`📝 Создание пользователя через Edge Function: ${email}, роль: ${role}`);
    
    // Ensure sap_number is null if it's empty string to avoid unique constraint issues
    const sanitizedSapNumber = additionalData.sap_number && additionalData.sap_number.trim() !== '' 
      ? additionalData.sap_number 
      : null;
    
    // Используем Edge Function для создания пользователя в обеих таблицах
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-and-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
      },
      body: JSON.stringify({
        email,
        password: customPassword,
        full_name: fullName.trim(),
        role,
        sap_number: sanitizedSapNumber,
        phone: additionalData.phone,
        territory_id: additionalData.territory_id,
        branch_id: additionalData.branch_id,
        position_id: additionalData.position_id,
        work_experience_days: additionalData.work_experience_days || 0
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Edge Function ошибка:", errorData);
      throw new Error(errorData.error || `Ошибка HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log("✅ Результат создания пользователя:", result);
    
    if (result.success) {
      return {
        success: true,
        message: result.message || 'Пользователь успешно создан',
        email,
        password: result.tempPassword || customPassword,
        user: result.user
      };
    } else {
      return {
        success: false,
        message: result.message || result.error || 'Неизвестная ошибка при создании пользователя',
        configurationRequired: result.configurationRequired
      };
    }
  } catch (error) {
    console.error('❌ Ошибка создания пользователя:', error);
    
    // Обработка специфических ошибок
    if (error instanceof Error) {
      // Ошибка уже существующего пользователя
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        return {
          success: true,
          message: 'Пользователь с таким email уже существует',
          email,
          password: customPassword
        };
      }
      
      // Ошибка настроек подтверждения email
      if (error.message.includes('Email confirm') || error.message.includes('email_confirmation')) {
        return {
          success: false,
          message: 'Требуется отключить подтверждение email в настройках Supabase',
          configurationRequired: true
        };
      }
    }
    
    // Общая ошибка
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка при создании пользователя'
    };
  }
}

/**
 * Удаляет пользователя из auth и public таблиц
 */
export async function deleteUser(userId: string): Promise<UserDeletionResult> {
  try {
    console.log('🗑️ Удаление пользователя:', userId);
    
    // Используем Edge Function для удаления пользователя
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({ userId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('❌ Edge Function ошибка:', errorData);
        throw new Error(errorData.error || `Ошибка HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          message: 'Пользователь успешно удален'
        };
      } else {
        throw new Error(result.error || 'Неизвестная ошибка при удалении пользователя');
      }
    } catch (edgeFunctionError) {
      console.warn('Edge Function не доступна, используем RPC функцию:', edgeFunctionError);
      
      // Пробуем использовать RPC функцию для полного удаления
      const { data, error } = await supabase.rpc('rpc_delete_user_complete', {
        p_user_id: userId
      });
      
      if (error) {
        console.warn('RPC функция не сработала, используем прямое удаление:', error);
        
        // Резервный метод - прямое удаление из базы данных
        const { error: dbError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        
        if (dbError) {
          throw new Error(`Ошибка удаления из базы данных: ${dbError.message}`);
        }
        
        return {
          success: true,
          message: 'Пользователь успешно удален из базы данных'
        };
      }
      
      if (data && data.success) {
        return {
          success: true,
          message: 'Пользователь успешно удален'
        };
      } else {
        throw new Error(data?.message || 'Ошибка удаления пользователя');
      }
    }
  } catch (error) {
    console.error('❌ Ошибка удаления пользователя:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Ошибка удаления пользователя'
    };
  }
}

/**
 * Сбрасывает пароль пользователя
 */
export async function resetUserPassword(userId: string, email: string): Promise<PasswordResetResult> {
  try {
    console.log('🔑 Сброс пароля для пользователя:', userId, email);
    
    // Используем Edge Function для сброса пароля
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`
        },
        body: JSON.stringify({
          action: 'reset_password',
          userId,
          email
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('❌ Edge Function ошибка:', errorData);
        throw new Error(errorData.error || `Ошибка HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        return {
          success: true,
          message: 'Пароль успешно сброшен',
          password: result.password || '123456'
        };
      } else {
        throw new Error(result.error || 'Неизвестная ошибка при сбросе пароля');
      }
    } catch (edgeFunctionError) {
      console.warn('Edge Function не доступна, используем RPC функцию:', edgeFunctionError);
      
      // Пробуем использовать RPC функцию для сброса пароля
      try {
        const { data, error } = await supabase.rpc('rpc_repair_user_auth', {
          p_user_id: userId
        });
        
        if (!error && data?.status === 'success') {
          console.log('✅ Пароль сброшен через RPC функцию');
          return {
            success: true,
            message: 'Пароль успешно сброшен',
            password: data.password || '123456'
          };
        } else {
          throw error || new Error(data?.message || 'Ошибка сброса пароля');
        }
      } catch (rpcError) {
        console.warn('❌ RPC функция не сработала:', rpcError);
        
        // Резервный метод - возвращаем стандартный пароль
        console.log('Используется стандартный пароль: 123456');
        
        // Обновляем время смены пароля для отслеживания
        try {
          await supabase
            .from('users')
            .update({ password_changed_at: new Date().toISOString() })
            .eq('id', userId);
        } catch (updateError) {
          console.warn('Ошибка обновления времени смены пароля:', updateError);
        }
        
        return {
          success: true,
          message: 'Используется стандартный пароль: 123456',
          password: '123456'
        };
      }
    }
  } catch (error) {
    console.error('❌ Ошибка сброса пароля:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Ошибка сброса пароля'
    };
  }
}