'use client';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Supplier } from '@/lib/types';
import ProbabilityPlot from './probability-plot';

interface ProbabilityPlotCardProps {
    supplier: Supplier;
}

export default function ProbabilityPlotCard({ supplier }: ProbabilityPlotCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{backgroundColor: supplier.color}} />
            {supplier.name}
        </CardTitle>
        <CardDescription className="text-xs">
            Aderência para distribuição {supplier.distribution}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 -mt-4">
        <ProbabilityPlot supplier={supplier} paperType={supplier.distribution} />
      </CardContent>
    </Card>
  );
}
