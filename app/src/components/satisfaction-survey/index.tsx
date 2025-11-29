'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Send } from 'lucide-react';
import { cn } from '@/lib/utils/helpers';
import { motion } from 'framer-motion';

interface SatisfactionSurveyProps {
  onSubmit: (rating: number, feedback: string) => void;
  className?: string;
}

export function SatisfactionSurvey({ onSubmit, className }: SatisfactionSurveyProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit(rating, feedback);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className={cn("bg-card/60 backdrop-blur-xl border-green-500/20", className)}>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <Star className="w-8 h-8 text-green-500 fill-current" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
          <p className="text-gray-400">Your feedback helps us improve the mix.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-card/60 backdrop-blur-xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Star className="w-5 h-5 mr-3 text-primary" />
          How was your experience?
        </CardTitle>
        <CardDescription>Rate the quality of your generated mashup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="focus:outline-none transition-transform hover:scale-110"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-colors duration-200",
                  (hoverRating || rating) >= star
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-600"
                )}
              />
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Any specific feedback? (Optional)"
            className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-none"
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={rating === 0}
          className="w-full"
          variant="glow"
        >
          <Send className="w-4 h-4 mr-2" />
          Submit Feedback
        </Button>
      </CardContent>
    </Card>
  );
}
