class UserServiceError(Exception):
    def __init__(self, message: str, error_code: str = None, context: dict = None):
        self.message = message
        self.error_code = error_code
        self.context = context or {}
        super().__init__(self.message)
    def __str__(self)->str:
        base_msg = self.message
        if self.error_code:
            message = f"[{self.error_code}]{base_msg}"
        return message
    
    def __repr__(self)->str:
        return f"{self.__class__.__name__}('{self.message}', error_code='{self.error_code}')"
        
class ValidationError(UserServiceError):
    def __init__(self, message: str, field: str = None, value = None, 
                 constraints: list = None, error_code: str = None, context: dict = None):
        self.field = field
        self.value = value
        self.constraints = constraints or []
        enhanced_context = context or {}
        if field:
            enhanced_context['field'] = field
        if value is not None:
            enhanced_context['value'] = value
        if constraints:
            enhanced_context['constraints'] = constraints
        
        super().__init__(message, error_code or "VALIDATION_ERROR", enhanced_context)



class DatabaseError(UserServiceError):
    def __init__(self, message: str, operation: str = None, table: str = None, original_error: Exception = None, error_code: str = None, context: dict = None):
        self.operation = operation
        self.table = table 
        self.original_error = original_error
        enhanced_context = context or {}

        if operation:
            enhanced_context['operation'] = operation
        if table:
            enhanced_context['table'] = table
        if original_error: 
            enhanced_context['original_error'] = str(original_error)

        super().__init__(message, error_code or "DATABASE_ERROR", enhanced_context)



class UserNotFoundError(UserServiceError):
    def __init__(self, message: str = None, user_id = None, search_criteria: dict = None, error_code: str = None, context: dict = None):
        if not message:
            message = f"User not found"
            if user_id:
                message += f" with ID: {user_id}"
        
        self.user_id = user_id
        self.search_criteria = search_criteria

        enhanced_context = context or {}
        if user_id:
            enhanced_context['user_id'] = user_id
        if search_criteria:
            enhanced_context['search_criteria'] = search_criteria

        super().__init__(message, error_code or "USER_NOT_FOUND", enhanced_context)


class AuthenticationError(UserServiceError):
    def __init__(self, message: str = "Authentication failed", username: str = None,
                 auth_method: str = None, error_code: str = None, context: dict = None):
        self.username = username
        self.auth_method = auth_method
        
  
        enhanced_context = context or {}
        if username:
            enhanced_context['username'] = username
        if auth_method:
            enhanced_context['auth_method'] = auth_method
        
        super().__init__(message, error_code or "AUTH_ERROR", enhanced_context)


class AuthorizationError(UserServiceError): 
    def __init__(self, message: str = "Insufficient permissions", user_id = None,
                 required_permission: str = None, operation: str = None,
                 error_code: str = None, context: dict = None):
        self.user_id = user_id
        self.required_permission = required_permission
        self.operation = operation
        
        enhanced_context = context or {}
        if user_id:
            enhanced_context['user_id'] = user_id
        if required_permission:
            enhanced_context['required_permission'] = required_permission
        if operation:
            enhanced_context['operation'] = operation
        
        super().__init__(message, error_code or "AUTHORIZATION_ERROR", enhanced_context)


class SessionError(UserServiceError):
    """Error related to consultation session management"""
    def __init__(self, message: str, session_id = None, consultation_id = None,
                 session_status: str = None, original_error: Exception = None,
                 error_code: str = None, context: dict = None):
        self.session_id = session_id
        self.consultation_id = consultation_id
        self.session_status = session_status
        self.original_error = original_error
        
        enhanced_context = context or {}
        if session_id:
            enhanced_context['session_id'] = session_id
        if consultation_id:
            enhanced_context['consultation_id'] = consultation_id
        if session_status:
            enhanced_context['session_status'] = session_status
        if original_error:
            enhanced_context['original_error'] = str(original_error)
        
        super().__init__(message, error_code or "SESSION_ERROR", enhanced_context)


class TransactionError(UserServiceError):
    """Error related to database transaction failures"""
    def __init__(self, message: str, operation: str = None, table: str = None,
                 transaction_state: str = None, original_error: Exception = None,
                 error_code: str = None, context: dict = None):
        self.operation = operation
        self.table = table
        self.transaction_state = transaction_state
        self.original_error = original_error
        
        enhanced_context = context or {}
        if operation:
            enhanced_context['operation'] = operation
        if table:
            enhanced_context['table'] = table
        if transaction_state:
            enhanced_context['transaction_state'] = transaction_state
        if original_error:
            enhanced_context['original_error'] = str(original_error)
        
        super().__init__(message, error_code or "TRANSACTION_ERROR", enhanced_context)


class ConnectionError(UserServiceError):
    """Error related to database connection failures"""
    def __init__(self, message: str = "Database connection failed", 
                 operation: str = None, retry_count: int = None,
                 original_error: Exception = None, error_code: str = None, 
                 context: dict = None):
        self.operation = operation
        self.retry_count = retry_count
        self.original_error = original_error
        
        enhanced_context = context or {}
        if operation:
            enhanced_context['operation'] = operation
        if retry_count is not None:
            enhanced_context['retry_count'] = retry_count
        if original_error:
            enhanced_context['original_error'] = str(original_error)
        
        super().__init__(message, error_code or "CONNECTION_ERROR", enhanced_context)


class DataIntegrityError(UserServiceError):
    """Error related to data integrity constraints (FK, unique, etc.)"""
    def __init__(self, message: str, constraint_type: str = None, 
                 table: str = None, field: str = None, value = None,
                 original_error: Exception = None, error_code: str = None, 
                 context: dict = None):
        self.constraint_type = constraint_type  # 'foreign_key', 'unique', 'not_null', etc.
        self.table = table
        self.field = field
        self.value = value
        self.original_error = original_error
        
        enhanced_context = context or {}
        if constraint_type:
            enhanced_context['constraint_type'] = constraint_type
        if table:
            enhanced_context['table'] = table
        if field:
            enhanced_context['field'] = field
        if value is not None:
            enhanced_context['value'] = value
        if original_error:
            enhanced_context['original_error'] = str(original_error)
        
        super().__init__(message, error_code or "DATA_INTEGRITY_ERROR", enhanced_context)


class ResourceNotFoundError(UserServiceError):
    """Error when a requested resource (consultation, session, etc.) is not found"""
    def __init__(self, message: str, resource_type: str = None, 
                 resource_id = None, search_criteria: dict = None,
                 error_code: str = None, context: dict = None):
        self.resource_type = resource_type  # 'consultation', 'session', 'transcript', etc.
        self.resource_id = resource_id
        self.search_criteria = search_criteria
        
        enhanced_context = context or {}
        if resource_type:
            enhanced_context['resource_type'] = resource_type
        if resource_id:
            enhanced_context['resource_id'] = resource_id
        if search_criteria:
            enhanced_context['search_criteria'] = search_criteria
        
        super().__init__(message, error_code or "RESOURCE_NOT_FOUND", enhanced_context)