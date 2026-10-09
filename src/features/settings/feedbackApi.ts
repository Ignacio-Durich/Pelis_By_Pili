import { CodedError, callRpc } from '../../lib/rpc'

export type FeedbackErrorKind = 'invalid_feedback' | 'too_many' | 'network'
export class FeedbackError extends CodedError<FeedbackErrorKind> {}

export const sendFeedback = (body: string) =>
  callRpc<void, FeedbackErrorKind>(
    'send_feedback',
    { p_body: body, p_user_agent: navigator.userAgent },
    ['invalid_feedback', 'too_many'],
    (kind) => new FeedbackError(kind),
  )
